import { and, eq } from "drizzle-orm";
import {
  db,
  workflowRunsTable,
  workflowsTable,
  type WorkflowRun,
} from "@workspace/db";
import type { AgentToolContext, AgentToolRegistry } from "./agent.js";
import { runAgent } from "./agent.js";
import type { ModelProvider } from "./provider.js";

export type WorkflowStep = {
  id: string;
  type: "ai" | "tool" | "condition" | "transform" | "wait" | "approval" | "webhook" | "notification" | "loop";
  name?: string;
  input?: Record<string, unknown>;
  tool?: string;
  condition?: { path: string; equals?: unknown; exists?: boolean };
  durationMs?: number;
  maxIterations?: number;
};

type Json = Record<string, unknown>;
type WorkflowContext = AgentToolContext & { workspaceId?: string };

export type WorkflowExecutionDependencies = {
  registry: AgentToolRegistry;
  provider: ModelProvider;
  context: WorkflowContext;
};

const activeRuns = new Set<string>();
const getPath = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) =>
    current && typeof current === "object" ? (current as Json)[key] : undefined, value);

const interpolate = (value: unknown, input: Json): unknown => {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{([^}]+)\}\}$/);
    if (exact) return getPath(input, exact[1].trim());
    return value.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => String(getPath(input, path.trim()) ?? ""));
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, input));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, input)]));
  }
  return value;
};

const asJson = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : { value };

export class WorkflowEngine {
  constructor(private readonly deps: WorkflowExecutionDependencies) {}

  async start(runId: string): Promise<void> {
    if (activeRuns.has(runId)) return;
    activeRuns.add(runId);
    try {
      await this.execute(runId);
    } finally {
      activeRuns.delete(runId);
    }
  }

  async resume(runId: string): Promise<void> {
    const [run] = await db.select().from(workflowRunsTable).where(eq(workflowRunsTable.id, runId));
    if (!run || !["paused", "waiting", "waiting_for_approval"].includes(run.status)) {
      throw new Error("Workflow run is not resumable");
    }
    await db.update(workflowRunsTable).set({ status: "queued", updatedAt: new Date() }).where(eq(workflowRunsTable.id, runId));
    await this.start(runId);
  }

  async approve(runId: string, approved: boolean, comment?: string): Promise<void> {
    const [run] = await db.select().from(workflowRunsTable).where(eq(workflowRunsTable.id, runId));
    if (!run || run.status !== "waiting_for_approval") throw new Error("Workflow run is not awaiting approval");
    await db.update(workflowRunsTable).set({
      approvalState: { approved, comment: comment ?? "", decidedAt: new Date().toISOString() },
      status: approved ? "queued" : "failed",
      errors: approved ? run.errors : [...(run.errors as unknown[]), { step: run.currentStep, message: comment ?? "Approval rejected" }],
      completedAt: approved ? null : new Date(),
      updatedAt: new Date(),
    }).where(eq(workflowRunsTable.id, runId));
    if (approved) await this.start(runId);
  }

  private async execute(runId: string): Promise<void> {
    const [run] = await db.select().from(workflowRunsTable).where(eq(workflowRunsTable.id, runId));
    if (!run) return;
    const [workflow] = await db.select().from(workflowsTable).where(and(
      eq(workflowsTable.id, run.workflowId),
      eq(workflowsTable.organizationId, run.organizationId),
    ));
    if (!workflow) throw new Error("Workflow definition not found");
    const steps = workflow.steps as WorkflowStep[];
    const input = asJson(run.input);
    let results = Array.isArray(run.stepResults) ? [...run.stepResults] as unknown[] : [];
    await db.update(workflowRunsTable).set({ status: "running", startedAt: run.startedAt ?? new Date(), updatedAt: new Date() }).where(eq(workflowRunsTable.id, runId));

    for (let index = run.currentStep; index < steps.length; index += 1) {
      const [latestRun] = await db.select({ status: workflowRunsTable.status }).from(workflowRunsTable).where(eq(workflowRunsTable.id, runId));
      if (!latestRun || latestRun.status === "paused" || latestRun.status === "cancelled") return;
      const step = steps[index];
      await db.update(workflowRunsTable).set({ currentStep: index, updatedAt: new Date() }).where(eq(workflowRunsTable.id, runId));
      try {
        const result = await this.executeStep(step, input, index);
        if (result.waiting) {
          await db.update(workflowRunsTable).set({
            status: result.status, currentStep: index + 1, stepResults: results,
            approvalState: result.status === "waiting_for_approval" ? { stepId: step.id, requestedAt: new Date().toISOString() } : undefined,
            updatedAt: new Date(),
          }).where(eq(workflowRunsTable.id, runId));
          if (result.resumeAfterMs) setTimeout(() => void this.resume(runId).catch(() => undefined), result.resumeAfterMs);
          return;
        }
        results.push({ stepId: step.id, type: step.type, result: result.value, completedAt: new Date().toISOString() });
        Object.assign(input, asJson(result.value));
        await db.update(workflowRunsTable).set({ stepResults: results, input, updatedAt: new Date() }).where(eq(workflowRunsTable.id, runId));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Workflow step failed";
        await db.update(workflowRunsTable).set({
          status: "failed",
          errors: [...(run.errors as unknown[]), { step: index, stepId: step.id, message }],
          updatedAt: new Date(),
          completedAt: new Date(),
        }).where(eq(workflowRunsTable.id, runId));
        return;
      }
    }
    await db.update(workflowRunsTable).set({
      status: "completed",
      currentStep: steps.length,
      finalResult: input,
      input,
      stepResults: results,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workflowRunsTable.id, runId));
  }

  private async executeStep(step: WorkflowStep, input: Json, index: number): Promise<{ value?: unknown; waiting?: boolean; status?: "waiting" | "waiting_for_approval"; resumeAfterMs?: number }> {
    const stepInput = asJson(interpolate(step.input ?? {}, input));
    switch (step.type) {
      case "tool": {
        if (!step.tool) throw new Error("Tool step requires tool");
        const tool = this.deps.registry.get(step.tool);
        if (!tool.roles.includes(this.deps.context.role)) throw new Error("Permission denied for workflow tool");
        return { value: await tool.execute(tool.input.parse(stepInput), this.deps.context) };
      }
      case "ai": {
        const result = await runAgent({
          provider: this.deps.provider,
          registry: this.deps.registry,
          context: this.deps.context,
          request: typeof stepInput.request === "string" ? stepInput.request : JSON.stringify(stepInput),
          maxSteps: 4,
        });
        if (result.status === "approval_required") return { waiting: true, status: "waiting_for_approval" };
        if (result.status !== "completed") throw new Error(result.reason ?? "AI step failed");
        return { value: { response: result.response, steps: result.steps } };
      }
      case "condition": {
        const actual = step.condition ? getPath(input, step.condition.path) : undefined;
        const matches = step.condition?.exists ? actual !== undefined : actual === step.condition?.equals;
        return { value: { condition: matches, next: matches ? index + 1 : index + 2 } };
      }
      case "transform": return { value: stepInput };
      case "wait": return { waiting: true, status: "waiting", resumeAfterMs: Math.max(1, step.durationMs ?? 0) };
      case "approval": return { waiting: true, status: "waiting_for_approval" };
      case "webhook": {
        const url = typeof stepInput.url === "string" ? stepInput.url : "";
        if (!url) throw new Error("Webhook step requires a URL");
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(stepInput.payload ?? input) });
        if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
        return { value: { status: response.status, body: await response.text() } };
      }
      case "notification": return { value: { notified: true, ...stepInput } };
      case "loop": {
        const items = Array.isArray(stepInput.items) ? stepInput.items : [];
        return { value: { iterations: Math.min(items.length, step.maxIterations ?? items.length), items } };
      }
      default: throw new Error(`Unsupported workflow step type: ${step.type}`);
    }
  }
}

export type { WorkflowRun };
