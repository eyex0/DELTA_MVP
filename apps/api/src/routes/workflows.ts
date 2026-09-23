import { Router } from "express";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  AgentToolRegistry,
  createListTasksTool,
  createProjectReadTool,
  createTaskTool,
  createConfiguredGateway,
  WorkflowEngine,
  type WorkflowStep,
} from "@workspace/ai";
import { db, projectsTable, tasksTable, workflowRunsTable, workflowsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const validTriggers = new Set(["manual", "ai", "scheduled", "event", "webhook"]);
const validSteps = new Set(["ai", "tool", "condition", "transform", "wait", "approval", "webhook", "notification", "loop"]);

async function scheduleRun(workflow: typeof workflowsTable.$inferSelect) {
  if (!workflow.scheduleAt || workflow.triggerType !== "scheduled" || !workflow.enabled) return;
  const delay = workflow.scheduleAt.getTime() - Date.now();
  if (delay < 0) return;
  setTimeout(async () => {
    const [run] = await db.insert(workflowRunsTable).values({
      workflowId: workflow.id, organizationId: workflow.organizationId, workspaceId: workflow.workspaceId,
      input: {}, status: "queued",
    }).returning();
    void engineFor({ id: workflow.createdBy, organizationId: workflow.organizationId, role: "admin" }, workflow.workspaceId ?? undefined).start(run.id);
  }, delay);
}

function buildRegistry() {
  return new AgentToolRegistry()
    .register(createProjectReadTool(async (projectId, context) => {
      const [project] = await db.select({ id: projectsTable.id, name: projectsTable.name, objective: projectsTable.objective, status: projectsTable.status })
        .from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, context.organizationId)));
      if (!project) throw new Error("Project not found");
      return project;
    }))
    .register(createTaskTool(async (input, context) => {
      if (!input.assignToMe) throw new Error("Only assignment to the current user is supported");
      const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(
        eq(projectsTable.organizationId, context.organizationId),
        input.projectId ? eq(projectsTable.id, input.projectId) : eq(projectsTable.organizationId, context.organizationId),
      ));
      if (!project) throw new Error("Project not found");
      const [task] = await db.insert(tasksTable).values({
        organizationId: context.organizationId, projectId: project.id, title: input.title,
        assignedTo: context.userId, createdBy: context.userId,
      }).returning({ id: tasksTable.id, projectId: tasksTable.projectId, title: tasksTable.title, assignedTo: tasksTable.assignedTo, status: tasksTable.status });
      return task;
    }))
    .register(createListTasksTool(async (input, context) => db.select({
      id: tasksTable.id, projectId: tasksTable.projectId, title: tasksTable.title, assignedTo: tasksTable.assignedTo, status: tasksTable.status,
    }).from(tasksTable).where(and(eq(tasksTable.organizationId, context.organizationId), eq(tasksTable.assignedTo, context.userId),
      ...(input.projectId ? [eq(tasksTable.projectId, input.projectId)] : []))).orderBy(desc(tasksTable.createdAt))));
}

function engineFor(user: NonNullable<Express.Request["user"]>, workspaceId?: string) {
  return new WorkflowEngine({
    registry: buildRegistry(),
    provider: createConfiguredGateway(),
    context: { userId: user.id, organizationId: user.organizationId, role: user.role as "delivery_lead" | "client_reviewer" | "admin", workspaceId: workspaceId ?? "default" },
  });
}

router.post("/workflow-webhooks/:workflowId", async (req, res) => {
  const [workflow] = await db.select().from(workflowsTable).where(and(eq(workflowsTable.id, req.params.workflowId), eq(workflowsTable.triggerType, "webhook")));
  const secret = req.header("x-delta-webhook-secret");
  if (!workflow || !workflow.enabled || !workflow.webhookSecret || secret !== workflow.webhookSecret) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid webhook credentials" } });
  }
  const [run] = await db.insert(workflowRunsTable).values({
    workflowId: workflow.id, organizationId: workflow.organizationId, workspaceId: workflow.workspaceId,
    input: req.body ?? {}, status: "queued",
  }).returning();
  void engineFor({ id: workflow.createdBy, organizationId: workflow.organizationId, role: "admin" }, workflow.workspaceId ?? undefined).start(run.id);
  return res.status(202).json({ runId: run.id, status: run.status });
});

router.use(requireAuth);

router.post("/workflows", async (req, res) => {
  const { name, description, triggerType, workspaceId, steps, scheduleAt } = req.body ?? {};
  if (!req.user || typeof name !== "string" || !name.trim() || !validTriggers.has(triggerType) ||
      !Array.isArray(steps) || steps.length === 0 || steps.some((step: WorkflowStep) => !step?.id || !validSteps.has(step.type))) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "name, triggerType and executable steps are required" } });
  }
  const webhookSecret = triggerType === "webhook" ? randomBytes(32).toString("hex") : undefined;
  const [workflow] = await db.insert(workflowsTable).values({
    organizationId: req.user.organizationId, workspaceId, name: name.trim(), description,
    triggerType, webhookSecret, steps, scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined, createdBy: req.user.id,
  }).returning();
  void scheduleRun(workflow);
  if (triggerType === "webhook") return res.status(201).json({ ...workflow, webhookSecret });
  return res.status(201).json(workflow);
});

router.get("/workflows", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const workflows = await db.select().from(workflowsTable).where(eq(workflowsTable.organizationId, req.user.organizationId)).orderBy(desc(workflowsTable.updatedAt)).limit(limit);
  return res.json(workflows);
});

router.post("/workflows/:workflowId/runs", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const [workflow] = await db.select().from(workflowsTable).where(and(eq(workflowsTable.id, req.params.workflowId), eq(workflowsTable.organizationId, req.user.organizationId)));
  if (!workflow || !workflow.enabled) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow not found or disabled" } });
  const requestedTrigger = req.body?.triggerType ?? "manual";
  if (workflow.triggerType !== requestedTrigger && !(workflow.triggerType === "ai" && requestedTrigger === "manual")) {
    return res.status(409).json({ error: { code: "TRIGGER_MISMATCH", message: `Workflow requires a ${workflow.triggerType} trigger` } });
  }
  const [run] = await db.insert(workflowRunsTable).values({
    workflowId: workflow.id, organizationId: req.user.organizationId, workspaceId: workflow.workspaceId,
    startedBy: req.user.id, input: req.body?.input ?? {}, status: "queued",
  }).returning();
  void engineFor(req.user, workflow.workspaceId ?? undefined).start(run.id);
  return res.status(202).json(run);
});

router.post("/workflow-events/:eventType", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const workflows = await db.select().from(workflowsTable).where(and(
    eq(workflowsTable.organizationId, req.user.organizationId),
    eq(workflowsTable.triggerType, "event"),
    eq(workflowsTable.enabled, true),
  ));
  const runs = [];
  for (const workflow of workflows) {
    const [run] = await db.insert(workflowRunsTable).values({
      workflowId: workflow.id, organizationId: workflow.organizationId, workspaceId: workflow.workspaceId,
      startedBy: req.user.id, input: { eventType: req.params.eventType, payload: req.body ?? {} }, status: "queued",
    }).returning();
    runs.push(run);
    void engineFor(req.user, workflow.workspaceId ?? undefined).start(run.id);
  }
  return res.status(202).json({ runs });
});

router.get("/workflow-runs/:runId", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const [run] = await db.select().from(workflowRunsTable).where(and(eq(workflowRunsTable.id, req.params.runId), eq(workflowRunsTable.organizationId, req.user.organizationId)));
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found" } });
  return res.json(run);
});

router.post("/workflow-runs/:runId/pause", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const [run] = await db.update(workflowRunsTable).set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(workflowRunsTable.id, req.params.runId), eq(workflowRunsTable.organizationId, req.user.organizationId), eq(workflowRunsTable.status, "running"))).returning();
  if (!run) return res.status(409).json({ error: { code: "INVALID_STATE", message: "Only running workflows can be paused" } });
  return res.json(run);
});

router.post("/workflow-runs/:runId/resume", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const [run] = await db.select().from(workflowRunsTable).where(and(eq(workflowRunsTable.id, req.params.runId), eq(workflowRunsTable.organizationId, req.user.organizationId)));
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found" } });
  try {
    await engineFor(req.user, run.workspaceId ?? undefined).resume(run.id);
    return res.json({ status: "queued", runId: run.id });
  } catch (error) {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: error instanceof Error ? error.message : "Run is not resumable" } });
  }
});

router.post("/workflow-runs/:runId/approval", async (req, res) => {
  if (!req.user || typeof req.body?.approved !== "boolean") return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "approved is required" } });
  const [run] = await db.select().from(workflowRunsTable).where(and(eq(workflowRunsTable.id, req.params.runId), eq(workflowRunsTable.organizationId, req.user.organizationId)));
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found" } });
  try {
    await engineFor(req.user, run.workspaceId ?? undefined).approve(run.id, req.body.approved, req.body.comment);
    return res.json({ status: req.body.approved ? "queued" : "failed", runId: run.id });
  } catch (error) {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: error instanceof Error ? error.message : "Approval is not valid" } });
  }
});

router.post("/workflow-runs/:runId/cancel", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const [run] = await db.update(workflowRunsTable).set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(workflowRunsTable.id, req.params.runId), eq(workflowRunsTable.organizationId, req.user.organizationId))).returning();
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found" } });
  return res.json(run);
});

export default router;
