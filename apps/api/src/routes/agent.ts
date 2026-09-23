import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { AgentToolRegistry, createConfiguredGateway, createListTasksTool, createProjectReadTool, createSearchKnowledgeTool, createTaskTool, createUpdateTaskTool, createVerifyTaskTool, runAgent } from "@workspace/ai";
import { agentMessagesTable, agentRunsTable, agentStepsTable, approvalsTable, assertProjectAccess, assertWorkspaceAccess, db, enqueueJob, idempotencyKeysTable, projectsTable, tasksTable, usageEventsTable } from "@workspace/db";
import { assembleKnowledgeContext, createKnowledgeSearchProvider, ingestKnowledgeDocument } from "@workspace/knowledge";
import { requireAuth } from "../middlewares/auth";

const router = Router();
type AgentRole = "delivery_lead" | "client_reviewer" | "admin";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isAgentRole(value: string): value is AgentRole {
  return value === "delivery_lead" || value === "client_reviewer" || value === "admin";
}

router.post("/knowledge/documents", requireAuth, async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const source = typeof req.body?.source === "string" ? req.body.source.trim() : title;
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : undefined;
  if (!req.user || !title || !content.trim() || content.length > 2_000_000 || (projectId && !isUuid(projectId))) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "title and non-empty document content are required" } });
  }
  try {
    if (projectId) {
      if (!(await assertProjectAccess(req.user, projectId))) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
      }
      const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(
        and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, req.user.organizationId)),
      );
      if (!project) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }
    const result = await ingestKnowledgeDocument({
      organizationId: req.user.organizationId,
      projectId,
      title,
      source,
      sourceType: typeof req.body?.sourceType === "string" ? req.body.sourceType : "text",
      content,
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document ingestion failed";
    return res.status(422).json({ error: { code: "INGESTION_FAILED", message } });
  }
});

router.post("/agents/run", requireAuth, async (req, res) => {
  const request = typeof req.body?.request === "string" ? req.body.request.trim() : "";
  const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : undefined;
  if (!req.user || request.length === 0 || request.length > 10_000 || (projectId && !isUuid(projectId))) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A non-empty request is required" } });
  }
  if (projectId && !(await assertProjectAccess(req.user, projectId))) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
  }
  const idempotencyKey = req.header("Idempotency-Key");
  if (idempotencyKey && idempotencyKey.length > 200) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Idempotency-Key is too long" } });
  }
  if (idempotencyKey) {
    const [existing] = await db.select({ response: idempotencyKeysTable.response }).from(idempotencyKeysTable).where(and(
      eq(idempotencyKeysTable.organizationId, req.user.organizationId),
      eq(idempotencyKeysTable.scope, "agents.run"),
      eq(idempotencyKeysTable.key, idempotencyKey),
    ));
    if (existing) {
      if (existing.response) return res.json(existing.response);
      return res.status(409).json({ error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "An execution with this idempotency key is already in progress" } });
    }
  }
  if (req.query.async === "true") {
    if (!req.user || !isAgentRole(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Unsupported user role" } });
    }
    const [run] = await db.insert(agentRunsTable).values({
      organizationId: req.user.organizationId, projectId, userId: req.user.id, request, status: "queued",
      provider: process.env.AI_PROVIDER ?? "foundry", tokenBudget: 8_000,
    }).returning({ id: agentRunsTable.id });
    if (!run) return res.status(500).json({ error: { code: "RUN_CREATE_FAILED", message: "Could not create agent execution" } });
    const queuedResponse = { executionId: run.id, status: "queued" as const };
    if (idempotencyKey) {
      const [reservation] = await db.insert(idempotencyKeysTable).values({
        organizationId: req.user.organizationId,
        scope: "agents.run",
        key: idempotencyKey,
        response: queuedResponse,
      }).onConflictDoNothing().returning({ id: idempotencyKeysTable.id });
      if (!reservation) {
        await db.delete(agentRunsTable).where(eq(agentRunsTable.id, run.id));
        const [existing] = await db.select({ response: idempotencyKeysTable.response }).from(idempotencyKeysTable).where(and(
          eq(idempotencyKeysTable.organizationId, req.user.organizationId),
          eq(idempotencyKeysTable.scope, "agents.run"),
          eq(idempotencyKeysTable.key, idempotencyKey),
        ));
        if (existing?.response) return res.json(existing.response);
        return res.status(409).json({ error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "An execution with this idempotency key is already in progress" } });
      }
    }
    await enqueueJob({
      organizationId: req.user.organizationId, workspaceId: projectId, kind: "agent.execution",
      payload: { runId: run.id, request, projectId, userId: req.user.id, organizationId: req.user.organizationId, role: req.user.role },
    });
    return res.status(202).json(queuedResponse);
  }

  const registry = new AgentToolRegistry().register(
    createSearchKnowledgeTool(async (input, context) => createKnowledgeSearchProvider().search({
      organizationId: context.organizationId,
      projectId: input.projectId ?? context.projectId,
      query: input.query,
      limit: input.limit,
    })),
  ).register(
    createProjectReadTool(async (projectId, context) => {
      const [project] = await db
        .select({
          id: projectsTable.id,
          name: projectsTable.name,
          objective: projectsTable.objective,
          status: projectsTable.status,
        })
        .from(projectsTable)
        .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, context.organizationId)));
      if (!project) throw new Error("Project not found");
      return project;
    }),
  ).register(
    createTaskTool(async (input, context) => {
      if (!input.assignToMe) throw new Error("Only assignment to the current user is supported");
      const requestedProjectId = input.projectId ?? context.projectId;
      const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(
        requestedProjectId
          ? and(eq(projectsTable.id, requestedProjectId), eq(projectsTable.organizationId, context.organizationId))
          : eq(projectsTable.organizationId, context.organizationId),
      );
      if (!project) throw new Error("Project not found");
      if (!(await assertProjectAccess({ id: context.userId, organizationId: context.organizationId }, project.id))) {
        throw new Error("Project access denied");
      }
      const [task] = await db.insert(tasksTable).values({
        organizationId: context.organizationId,
        projectId: project.id,
        title: input.title,
        assignedTo: context.userId,
        createdBy: context.userId,
      }).returning({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        title: tasksTable.title,
        assignedTo: tasksTable.assignedTo,
        status: tasksTable.status,
      });
      return task;
    }),
  ).register(
    createListTasksTool(async (input, context) => {
      const conditions = [eq(tasksTable.organizationId, context.organizationId), eq(tasksTable.assignedTo, context.userId)];
      if (input.projectId) conditions.push(eq(tasksTable.projectId, input.projectId));
      if (input.status) conditions.push(eq(tasksTable.status, input.status));
      return db.select({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        title: tasksTable.title,
        assignedTo: tasksTable.assignedTo,
        status: tasksTable.status,
      }).from(tasksTable).where(and(...conditions)).orderBy(desc(tasksTable.createdAt));
    }),
  ).register(
    createUpdateTaskTool(async (input, context) => {
      const [task] = await db.update(tasksTable).set({
        ...(input.title ? { title: input.title } : {}),
        ...(input.status ? { status: input.status } : {}),
        updatedAt: new Date(),
      }).where(and(eq(tasksTable.id, input.taskId), eq(tasksTable.organizationId, context.organizationId), eq(tasksTable.assignedTo, context.userId))).returning({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        title: tasksTable.title,
        assignedTo: tasksTable.assignedTo,
        status: tasksTable.status,
      });
      if (!task) throw new Error("Task not found or access denied");
      return task;
    }),
  ).register(
    createVerifyTaskTool(async (taskId, context) => {
      const [task] = await db.select({
        id: tasksTable.id,
        projectId: tasksTable.projectId,
        title: tasksTable.title,
        assignedTo: tasksTable.assignedTo,
        status: tasksTable.status,
      }).from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.organizationId, context.organizationId), eq(tasksTable.assignedTo, context.userId)));
      if (!task) throw new Error("Task not found or access denied");
      return task;
    }),
  );

  let runId: string | undefined;
  try {
    if (!isAgentRole(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Unsupported user role" } });
    }
    const [run] = await db.insert(agentRunsTable).values({
      organizationId: req.user.organizationId,
      projectId,
      userId: req.user.id,
      request,
      status: "running",
      provider: process.env.AI_PROVIDER ?? "foundry",
      tokenBudget: 8_000,
    }).returning({ id: agentRunsTable.id });
    runId = run.id;
    let messageSequence = 0;

    const result = await runAgent({
      provider: createConfiguredGateway(),
      registry,
      context: {
        userId: req.user.id,
        organizationId: req.user.organizationId,
        workspaceId: projectId ?? "default",
        role: req.user.role,
        projectId,
      },
      request,
      contextAssembler: async (query, context) => {
        const assembled = await assembleKnowledgeContext({
          organizationId: context.organizationId,
          projectId: context.projectId,
          query,
          limit: 5,
          userId: context.userId,
        });
        if (assembled.text.trim()) return assembled.text;

        const projects = await db
          .select({
            id: projectsTable.id,
            name: projectsTable.name,
            clientName: projectsTable.clientName,
            objective: projectsTable.objective,
            status: projectsTable.status,
          })
          .from(projectsTable)
          .where(eq(projectsTable.organizationId, context.organizationId))
          .orderBy(desc(projectsTable.updatedAt))
          .limit(10);

        if (projects.length === 0) {
          return "No project or knowledge sources have been created in this workspace yet. Explain that the user should create a project and add source material before requesting project-specific analysis.";
        }

        return [
          "No indexed knowledge was found for this request. Use the available workspace project records as context:",
          ...projects.map((project) =>
            `- ${project.name} (${project.clientName}), status: ${project.status}, objective: ${project.objective ?? "Not defined"}, id: ${project.id}`,
          ),
          `User request: ${query}`,
        ].join("\n");
      },
      tokenBudget: 8_000,
      onMessage: async (message) => {
        await db.insert(agentMessagesTable).values({
          runId: run.id,
          sequence: messageSequence++,
          role: message.role,
          content: message.content,
          toolCallId: message.role === "tool" ? message.toolCallId : undefined,
          toolCalls: message.role === "assistant" ? message.toolCalls : undefined,
        });
      },
      shouldContinue: async () => {
        const [current] = await db.select({ status: agentRunsTable.status }).from(agentRunsTable).where(eq(agentRunsTable.id, run.id));
        return current?.status === "running";
      },
      onEvent: async (event) => {
        await db.insert(agentStepsTable).values({
          runId: run.id,
          step: "step" in event ? event.step : 0,
          eventType: event.type,
          tool: "tool" in event ? event.tool : undefined,
          input: event.type === "decision" && event.decision.type === "tool_call" ? event.decision.input : undefined,
          output: event.type === "tool_completed" ? { completed: true } : undefined,
          error: event.type === "tool_failed" ? event.error : undefined,
        });
      },
    });
    await db.update(agentRunsTable).set({
      status: result.reason === "Agent execution cancelled" ? "cancelled" : result.status === "escalated" ? "escalated" : result.status,
      response: result.response,
      error: result.reason,
      currentStep: result.steps,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
      model: result.model,
      requestId: result.requestIds?.[0],
      latencyMs: result.latencyMs,
      completedAt: new Date(),
    }).where(eq(agentRunsTable.id, run.id));
    if (result.status === "approval_required" && result.approval) {
      await db.insert(approvalsTable).values({
        organizationId: req.user.organizationId,
        workspaceId: projectId,
        agentRunId: run.id,
        requesterId: req.user.id,
        action: result.approval.tool ?? "agent_action",
        reason: result.approval.reason,
        input: result.approval.input ?? {},
      });
    }
    if (result.usage?.totalTokens && result.provider && result.model) {
      await db.insert(usageEventsTable).values({
        organizationId: req.user.organizationId,
        workspaceId: projectId,
        userId: req.user.id,
        executionId: run.id,
        provider: result.provider,
        model: result.model,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens,
      });
    }
    if (idempotencyKey) {
      await db.insert(idempotencyKeysTable).values({
        organizationId: req.user.organizationId,
        scope: "agents.run",
        key: idempotencyKey,
        response: result,
      }).onConflictDoNothing();
    }
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed";
    if (runId) {
      await db.update(agentRunsTable).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(agentRunsTable.id, runId));
    }
    return res.status(502).json({ error: { code: "AGENT_FAILED", message } });
  }
});

router.get("/agent-runs/:runId", requireAuth, async (req, res) => {
  const runIdParam = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  if (!req.user || !runIdParam || !isUuid(runIdParam)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent run not found" } });
  }
  const [run] = await db.select().from(agentRunsTable).where(
    and(
      eq(agentRunsTable.id, runIdParam),
      eq(agentRunsTable.organizationId, req.user.organizationId),
      req.user.role === "admin" ? eq(agentRunsTable.organizationId, req.user.organizationId) : eq(agentRunsTable.userId, req.user.id),
    ),
  );
  if (!run) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent run not found" } });
  }
  const [steps, messages] = await Promise.all([
    db.select().from(agentStepsTable).where(eq(agentStepsTable.runId, run.id)),
    db.select().from(agentMessagesTable).where(eq(agentMessagesTable.runId, run.id)),
  ]);
  return res.json({ run, steps, messages });
});

router.get("/agent-runs/:runId/events", requireAuth, async (req, res): Promise<void> => {
  const runIdParam = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  if (!req.user || !runIdParam || !isUuid(runIdParam)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent run not found" } });
    return;
  }
  const [run] = await db.select({ id: agentRunsTable.id }).from(agentRunsTable).where(and(
    eq(agentRunsTable.id, runIdParam),
    eq(agentRunsTable.organizationId, req.user.organizationId),
    req.user.role === "admin" ? eq(agentRunsTable.organizationId, req.user.organizationId) : eq(agentRunsTable.userId, req.user.id),
  ));
  if (!run) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent run not found" } });
    return;
  }

  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const emittedSteps = new Set<string>();
  let closed = false;
  const send = (event: string, data: unknown) => {
    if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const poll = async (): Promise<void> => {
    if (closed) return;
    if (req.user?.tokenExpiresAt && Date.now() >= req.user.tokenExpiresAt * 1000) {
      send("execution.auth_expired", { executionId: run.id });
      closed = true;
      clearInterval(timer);
      res.end();
      return;
    }
    const [current] = await db.select().from(agentRunsTable).where(eq(agentRunsTable.id, run.id));
    const steps = await db.select().from(agentStepsTable).where(eq(agentStepsTable.runId, run.id)).orderBy(agentStepsTable.createdAt);
    for (const step of steps) {
      if (!emittedSteps.has(step.id)) {
        send(step.eventType, { executionId: run.id, step: step.step, tool: step.tool, output: step.output, error: step.error });
        emittedSteps.add(step.id);
      }
    }
    if (current && ["completed", "failed", "cancelled", "escalated", "approval_required"].includes(current.status)) {
      send(`execution.${current.status}`, { executionId: run.id, status: current.status, response: current.response, error: current.error });
      clearInterval(timer);
      res.end();
    }
  };
  const timer = setInterval(() => void poll(), 1_000);
  req.on("close", () => {
    closed = true;
    clearInterval(timer);
  });
  send("execution.started", { executionId: run.id });
  await poll();
});

router.post("/agent-runs/:runId/cancel", requireAuth, async (req, res) => {
  const runIdParam = Array.isArray(req.params.runId) ? req.params.runId[0] : req.params.runId;
  if (!req.user || !runIdParam || !isUuid(runIdParam)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Agent run not found" } });
  }
  const [run] = await db.update(agentRunsTable)
    .set({ status: "cancelled", error: "Cancellation requested", completedAt: new Date() })
    .where(and(
      eq(agentRunsTable.id, runIdParam),
      eq(agentRunsTable.organizationId, req.user.organizationId),
      req.user.role === "admin" ? eq(agentRunsTable.organizationId, req.user.organizationId) : eq(agentRunsTable.userId, req.user.id),
      eq(agentRunsTable.status, "running"),
    ))
    .returning();
  if (!run) return res.status(409).json({ error: { code: "NOT_CANCELLABLE", message: "Agent run is not currently running" } });
  return res.json({ run });
});

router.get("/tasks/:taskId", requireAuth, async (req, res) => {
  const taskIdParam = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
  if (!req.user || !taskIdParam || !isUuid(taskIdParam)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
  }
  const [task] = await db.select().from(tasksTable).where(
    and(
      eq(tasksTable.id, taskIdParam),
      eq(tasksTable.organizationId, req.user.organizationId),
      req.user.role === "admin"
        ? eq(tasksTable.organizationId, req.user.organizationId)
        : eq(tasksTable.assignedTo, req.user.id),
    ),
  );
  if (!task) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Task not found" } });
  }
  return res.json({ task });
});

export default router;
