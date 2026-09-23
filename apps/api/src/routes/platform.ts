import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  agentVersionsTable,
  agentsTable,
  agentRunsTable,
  approvalsTable,
  assertWorkspaceAccess,
  db,
  enqueueJob,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

router.get("/agents", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const rows = await db.select().from(agentsTable)
    .where(eq(agentsTable.organizationId, req.user.organizationId))
    .orderBy(desc(agentsTable.updatedAt));
  const agents = [];
  for (const agent of rows) {
    if (!agent.workspaceId || await assertWorkspaceAccess(req.user, agent.workspaceId)) agents.push(agent);
  }
  return res.json({ agents });
});

router.post("/agents", requireRole("delivery_lead", "admin"), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const name = text(req.body?.name);
  if (!name || name.length > 120) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Agent name is required" } });
  }
  const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId : undefined;
  if (workspaceId && !(await assertWorkspaceAccess(req.user, workspaceId))) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workspace not found" } });
  }
  const [agent] = await db.insert(agentsTable).values({
    organizationId: req.user.organizationId,
    workspaceId,
    name,
    description: text(req.body?.description) || undefined,
    createdBy: req.user.id,
  }).returning();
  return res.status(201).json({ agent });
});

router.get("/agents/:agentId", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const agentId = param(req.params.agentId);
  const [agent] = await db.select().from(agentsTable).where(and(
    eq(agentsTable.id, agentId),
    eq(agentsTable.organizationId, req.user.organizationId),
  ));
  if (!agent) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  if (agent.workspaceId && !(await assertWorkspaceAccess(req.user, agent.workspaceId))) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  }
  const versions = await db.select().from(agentVersionsTable)
    .where(eq(agentVersionsTable.agentId, agent.id))
    .orderBy(desc(agentVersionsTable.version));
  return res.json({ agent, versions });
});

router.post("/agents/:agentId/versions", requireRole("delivery_lead", "admin"), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const agentId = param(req.params.agentId);
  const [agent] = await db.select().from(agentsTable).where(and(
    eq(agentsTable.id, agentId),
    eq(agentsTable.organizationId, req.user.organizationId),
  ));
  if (!agent) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  const existing = await db.select({ version: agentVersionsTable.version }).from(agentVersionsTable)
    .where(eq(agentVersionsTable.agentId, agent.id))
    .orderBy(desc(agentVersionsTable.version))
    .limit(1);
  const [version] = await db.insert(agentVersionsTable).values({
    agentId: agent.id,
    version: (existing[0]?.version ?? 0) + 1,
    instructions: text(req.body?.instructions),
    model: text(req.body?.model, process.env.FOUNDRY_MODEL ?? process.env.NVIDIA_MODEL ?? "configured-model"),
    knowledgeSourceIds: Array.isArray(req.body?.knowledgeSourceIds) ? req.body.knowledgeSourceIds.filter((value: unknown): value is string => typeof value === "string") : [],
    toolNames: Array.isArray(req.body?.toolNames) ? req.body.toolNames.filter((value: unknown): value is string => typeof value === "string") : [],
    approvalPolicy: req.body?.approvalPolicy && typeof req.body.approvalPolicy === "object" ? req.body.approvalPolicy : {},
    createdBy: req.user.id,
  }).returning();
  if (!version) return res.status(500).json({ error: { code: "VERSION_CREATE_FAILED" } });
  return res.status(201).json({ version });
});

router.post("/agents/:agentId/publish", requireRole("delivery_lead", "admin"), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const agentId = param(req.params.agentId);
  const versionId = text(req.body?.versionId);
  const [version] = await db.select().from(agentVersionsTable).where(and(
    eq(agentVersionsTable.id, versionId),
    eq(agentVersionsTable.agentId, agentId),
  ));
  const [agent] = await db.select().from(agentsTable).where(and(
    eq(agentsTable.id, agentId),
    eq(agentsTable.organizationId, req.user.organizationId),
  ));
  if (!agent || !version) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent or version not found" } });
  if (agent.workspaceId && !(await assertWorkspaceAccess(req.user, agent.workspaceId))) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent not found" } });
  }
  const [published] = await db.update(agentVersionsTable).set({ publishedAt: new Date() }).where(eq(agentVersionsTable.id, version.id)).returning();
  const [updated] = await db.update(agentsTable).set({ activeVersionId: version.id, status: "active", updatedAt: new Date() }).where(eq(agentsTable.id, agent.id)).returning();
  return res.json({ agent: updated, version: published });
});

router.get("/approvals", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const approvals = await db.select().from(approvalsTable)
    .where(eq(approvalsTable.organizationId, req.user.organizationId))
    .orderBy(desc(approvalsTable.requestedAt));
  const visibleApprovals = [];
  for (const approval of approvals) {
    if (!approval.workspaceId || await assertWorkspaceAccess(req.user, approval.workspaceId)) visibleApprovals.push(approval);
  }
  return res.json({ approvals: visibleApprovals });
});

router.post("/approvals/:approvalId/decision", requireRole("delivery_lead", "admin"), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: { code: "UNAUTHORIZED" } });
  const approvalId = param(req.params.approvalId);
  const decision = req.body?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Decision must be approved or rejected" } });
  }
  const [pending] = await db.select().from(approvalsTable).where(and(
    eq(approvalsTable.id, approvalId),
    eq(approvalsTable.organizationId, req.user.organizationId),
    eq(approvalsTable.status, "pending"),
  ));
  if (!pending || (pending.workspaceId && !(await assertWorkspaceAccess(req.user, pending.workspaceId)))) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pending approval not found" } });
  }
  const [approval] = await db.update(approvalsTable).set({
    status: decision,
    approverId: req.user.id,
    decisionComment: text(req.body?.comment) || undefined,
    decidedAt: new Date(),
  }).where(and(
    eq(approvalsTable.id, approvalId),
    eq(approvalsTable.organizationId, req.user.organizationId),
    eq(approvalsTable.status, "pending"),
  )).returning();
  if (!approval) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pending approval not found" } });
  if (decision === "approved") {
    const [run] = await db.update(agentRunsTable).set({ status: "running", error: null }).where(and(
      eq(agentRunsTable.id, approval.agentRunId),
      eq(agentRunsTable.organizationId, req.user.organizationId),
    )).returning();
    if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent run not found" } });
    await enqueueJob({
      organizationId: req.user.organizationId,
      workspaceId: approval.workspaceId ?? undefined,
      kind: "agent.execution",
      payload: {
        approvalId: approval.id,
        runId: approval.agentRunId,
        request: run.request,
        projectId: run.projectId ?? undefined,
        userId: run.userId,
        organizationId: run.organizationId,
        role: req.user.role,
        resumed: true,
      },
    });
  } else {
    await db.update(agentRunsTable).set({ status: "cancelled", error: "Approval rejected", completedAt: new Date() }).where(and(
      eq(agentRunsTable.id, approval.agentRunId),
      eq(agentRunsTable.organizationId, req.user.organizationId),
    ));
  }
  return res.json({ approval });
});

export default router;
