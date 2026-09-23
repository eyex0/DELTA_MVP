import { and, eq } from "drizzle-orm";
import {
  AgentToolRegistry,
  createConfiguredGateway,
  createListTasksTool,
  createProjectReadTool,
  createSearchKnowledgeTool,
  createTaskTool,
  createUpdateTaskTool,
  createVerifyTaskTool,
  runAgent,
} from "@workspace/ai";
import {
  agentMessagesTable,
  agentRunsTable,
  agentStepsTable,
  assembleKnowledgeContext,
  approvalsTable,
  createKnowledgeSearchProvider,
  db,
  executionJobsTable,
  projectsTable,
  tasksTable,
  usersTable,
  usageEventsTable,
} from "@workspace/db";
import type { ExecutionJob } from "@workspace/db";

type JobPayload = { runId: string; request: string; projectId?: string; userId: string; organizationId: string; role: "delivery_lead" | "client_reviewer" | "admin" };

function createRegistry() {
  return new AgentToolRegistry()
    .register(createSearchKnowledgeTool(async (input, context) => createKnowledgeSearchProvider().search({
      organizationId: context.organizationId, projectId: input.projectId ?? context.projectId, query: input.query, limit: input.limit,
    })))
    .register(createProjectReadTool(async (projectId, context) => {
      const [project] = await db.select({ id: projectsTable.id, name: projectsTable.name, objective: projectsTable.objective, status: projectsTable.status })
        .from(projectsTable).where(and(
          eq(projectsTable.id, projectId),
          eq(projectsTable.organizationId, context.organizationId),
        ));
      if (!project) throw new Error("Project not found");
      return project;
    }))
    .register(createTaskTool(async (input, context) => {
      if (!input.assignToMe) throw new Error("Only assignment to the current user is supported");
      const requestedProjectId = input.projectId ?? context.projectId;
      if (!requestedProjectId) throw new Error("A project is required for task creation");
      const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(
        eq(projectsTable.id, requestedProjectId),
        eq(projectsTable.organizationId, context.organizationId),
      ));
      if (!project) throw new Error("Project not found");
      const [task] = await db.insert(tasksTable).values({
        organizationId: context.organizationId, projectId: input.projectId ?? context.projectId!, title: input.title,
        assignedTo: context.userId, createdBy: context.userId,
      }).returning({ id: tasksTable.id, projectId: tasksTable.projectId, title: tasksTable.title, assignedTo: tasksTable.assignedTo, status: tasksTable.status });
      if (!task) throw new Error("Task could not be created");
      return task;
    }))
    .register(createListTasksTool(async (input, context) => db.select({
      id: tasksTable.id, projectId: tasksTable.projectId, title: tasksTable.title, assignedTo: tasksTable.assignedTo, status: tasksTable.status,
    }).from(tasksTable).where(and(
      eq(tasksTable.organizationId, context.organizationId),
      eq(tasksTable.assignedTo, context.userId),
    ))))
    .register(createUpdateTaskTool(async (input, context) => {
      const [task] = await db.update(tasksTable).set({ ...(input.title ? { title: input.title } : {}), ...(input.status ? { status: input.status } : {}), updatedAt: new Date() })
        .where(and(
          eq(tasksTable.id, input.taskId),
          eq(tasksTable.organizationId, context.organizationId),
          eq(tasksTable.assignedTo, context.userId),
        )).returning({ id: tasksTable.id, projectId: tasksTable.projectId, title: tasksTable.title, assignedTo: tasksTable.assignedTo, status: tasksTable.status });
      if (!task) throw new Error("Task not found or access denied");
      return task;
    }))
    .register(createVerifyTaskTool(async (taskId, context) => {
      const [task] = await db.select({ id: tasksTable.id, projectId: tasksTable.projectId, title: tasksTable.title, assignedTo: tasksTable.assignedTo, status: tasksTable.status })
        .from(tasksTable).where(and(
          eq(tasksTable.id, taskId),
          eq(tasksTable.organizationId, context.organizationId),
          eq(tasksTable.assignedTo, context.userId),
        ));
      if (!task) throw new Error("Task not found or access denied");
      return task;
    }));
}

export async function processAgentJob(job: ExecutionJob): Promise<void> {
  const payload = job.payload as unknown as JobPayload;
  if (!payload || typeof payload.runId !== "string") {
    throw new Error("Invalid agent job payload: runId is required");
  }

  const [sourceRun] = await db.select({
    id: agentRunsTable.id,
    organizationId: agentRunsTable.organizationId,
    userId: agentRunsTable.userId,
    projectId: agentRunsTable.projectId,
    request: agentRunsTable.request,
  }).from(agentRunsTable).where(eq(agentRunsTable.id, payload.runId));
  if (!sourceRun) throw new Error("Agent run not found");
  if (sourceRun.organizationId !== job.organizationId) {
    throw new Error("Agent job organization does not match its trusted run");
  }
  if (payload.userId && payload.userId !== sourceRun.userId) {
    throw new Error("Agent job user does not match its trusted run");
  }
  if (payload.projectId && payload.projectId !== sourceRun.projectId) {
    throw new Error("Agent job project does not match its trusted run");
  }

  const organizationId = sourceRun.organizationId;
  const userId = sourceRun.userId;
  const projectId = sourceRun.projectId ?? undefined;
  const request = sourceRun.request;
  const [sourceUser] = await db.select({ role: usersTable.role }).from(usersTable).where(and(
    eq(usersTable.id, userId),
    eq(usersTable.organizationId, organizationId),
  ));
  if (!sourceUser) throw new Error("Agent run user is not a member of its organization");
  const role = sourceUser.role;
  const [run] = await db.update(agentRunsTable).set({ status: "running" }).where(and(
    eq(agentRunsTable.id, sourceRun.id),
    eq(agentRunsTable.organizationId, organizationId),
  )).returning();
  if (!run) throw new Error("Agent run not found");
  let sequence = (await db.select().from(agentMessagesTable).where(eq(agentMessagesTable.runId, run.id))).length;
  const result = await runAgent({
    provider: createConfiguredGateway(),
    registry: createRegistry(),
    context: { userId, organizationId, workspaceId: projectId ?? "default", role, projectId },
    request,
    contextAssembler: async (query, context) => (await assembleKnowledgeContext({ organizationId: context.organizationId, projectId: context.projectId, query, limit: 5, userId: context.userId })).text,
    tokenBudget: 8_000,
    onMessage: async (message) => {
      await db.insert(agentMessagesTable).values({ runId: run.id, sequence: sequence++, role: message.role, content: message.content, toolCallId: message.role === "tool" ? message.toolCallId : undefined, toolCalls: message.role === "assistant" ? message.toolCalls : undefined });
    },
    shouldContinue: async () => {
      const [current] = await db.select({ status: agentRunsTable.status }).from(agentRunsTable).where(eq(agentRunsTable.id, run.id));
      return current?.status === "running";
    },
    onEvent: async (event) => {
      await db.insert(agentStepsTable).values({ runId: run.id, step: "step" in event ? event.step : 0, eventType: event.type, tool: "tool" in event ? event.tool : undefined, input: event.type === "decision" && event.decision.type === "tool_call" ? event.decision.input : undefined, output: event.type === "tool_completed" ? { completed: true } : undefined, error: event.type === "tool_failed" ? event.error : undefined });
    },
  });
  await db.update(agentRunsTable).set({
    status: result.reason === "Agent execution cancelled" ? "cancelled" : result.status === "escalated" ? "escalated" : result.status,
    response: result.response, error: result.reason, currentStep: result.steps, inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens, totalTokens: result.usage?.totalTokens, model: result.model, requestId: result.requestIds?.[0],
    latencyMs: result.latencyMs, completedAt: new Date(),
  }).where(eq(agentRunsTable.id, run.id));
  if (result.status === "approval_required" && result.approval) {
    await db.insert(approvalsTable).values({
      organizationId,
      workspaceId: projectId,
      agentRunId: run.id,
      requesterId: userId,
      action: result.approval.tool ?? "agent_action",
      reason: result.approval.reason,
      input: result.approval.input ?? {},
    });
  }
  if (result.usage?.totalTokens && result.provider && result.model) {
    await db.insert(usageEventsTable).values({ organizationId, workspaceId: projectId, userId, executionId: run.id, provider: result.provider, model: result.model, inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens });
  }
}

export async function processAgentJobById(jobId: string): Promise<void> {
  const [job] = await db.select().from(executionJobsTable).where(eq(executionJobsTable.id, jobId));
  if (!job) throw new Error("Execution job not found");
  await processAgentJob(job);
}
