import { randomUUID, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import {
  createWorkflow,
  createWorkflowRun,
  claimRunnableWorkflowRuns,
  getWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
  listWorkflows,
  pool,
  type WorkflowRunRecord,
  updateWorkflow,
  updateWorkflowRun,
} from "@workspace/db";

const router = Router();

const workflowStore = new Map<string, any>();
const workflowRunStore = new Map<string, any>();
const workflowTimers = new Map<string, ReturnType<typeof setTimeout>>();
const workflowQueue = new Set<string>();
const workflowRetryQueue = new Map<string, number>();
let scheduledWorkflowPollerStarted = false;

const statusTransitions: Record<string, string[]> = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["WAITING", "WAITING_FOR_APPROVAL", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"],
  WAITING: ["RUNNING", "PAUSED", "CANCELLED"],
  WAITING_FOR_APPROVAL: ["RUNNING", "FAILED", "CANCELLED"],
  PAUSED: ["RUNNING", "CANCELLED"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};

const normalizeStatus = (status: string | undefined | null): string => {
  const value = (status ?? "QUEUED").toString().trim().toUpperCase();
  const mapping: Record<string, string> = {
    QUEUED: "QUEUED",
    RUNNING: "RUNNING",
    WAITING: "WAITING",
    WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
    PAUSED: "PAUSED",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
  };
  return mapping[value] ?? "QUEUED";
};

const stepTypes = ["AI", "TOOL", "CONDITION", "TRANSFORM", "WAIT", "APPROVAL", "WEBHOOK", "NOTIFICATION", "LOOP"];

const makeId = (prefix: string) => `${prefix}-${randomUUID()}`;

const getStepPath = (source: any, path: string): any => {
  if (!source || !path) return undefined;
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), source);
};

const resolveValue = (value: any, context: Record<string, any>): any => {
  if (typeof value === "string" && /^\{\{.*\}\}$/.test(value)) {
    const key = value.slice(2, -2).trim();
    return getStepPath(context, key) ?? value;
  }
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
      const resolved = getStepPath(context, key.trim());
      return resolved == null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveValue(entry, context)]));
  }
  return value;
};

const serializeWorkflow = (workflow: any) => ({
  id: workflow.id,
  workflowId: workflow.id,
  workflow_id: workflow.id,
  organizationId: workflow.organizationId,
  organization_id: workflow.organizationId,
  workspaceId: workflow.workspaceId,
  workspace_id: workflow.workspaceId,
  name: workflow.name,
  description: workflow.description ?? null,
  triggerType: workflow.triggerType,
  enabled: workflow.enabled ?? true,
  steps: workflow.steps ?? [],
  scheduleAt: workflow.scheduleAt ?? null,
  scheduleTriggeredAt: workflow.scheduleTriggeredAt ?? null,
  createdBy: workflow.createdBy ?? null,
  createdAt: workflow.createdAt ?? new Date().toISOString(),
  updatedAt: workflow.updatedAt ?? new Date().toISOString(),
  webhookSecret: workflow.webhookSecret ?? null,
});

const serializeWorkflowRun = (run: any) => ({
  id: run.id,
  workflowRunId: run.id,
  workflow_run_id: run.id,
  workflowId: run.workflowId,
  workflow_id: run.workflowId,
  organizationId: run.organizationId,
  organization_id: run.organizationId,
  workspaceId: run.workspaceId,
  workspace_id: run.workspaceId,
  startedBy: run.startedBy ?? null,
  started_by: run.startedBy ?? null,
  currentStep: run.currentStep ?? 0,
  status: normalizeStatus(run.status) as WorkflowRunRecord["status"],
  input: run.input ?? {},
  stepResults: run.stepResults ?? [],
  errors: run.errors ?? [],
  approvalState: run.approvalState ?? null,
  approval_state: run.approvalState ?? null,
  retryState: run.retryState ?? {},
  retry_state: run.retryState ?? {},
  finalResult: run.finalResult ?? null,
  final_result: run.finalResult ?? null,
  startedAt: run.startedAt ?? null,
  updatedAt: run.updatedAt ?? null,
  completedAt: run.completedAt ?? null,
  timestamps: {
    startedAt: run.startedAt ?? null,
    updatedAt: run.updatedAt ?? null,
    completedAt: run.completedAt ?? null,
  },
});

const readWorkflow = async (workflowId: string) => {
  if (pool) return getWorkflow(workflowId);
  return workflowStore.get(workflowId) ?? null;
};

const saveWorkflow = async (workflow: any) => {
  workflow.updatedAt = new Date().toISOString();
  if (pool) {
    const existing = await getWorkflow(workflow.id);
    const persisted = existing
      ? await updateWorkflow(workflow.id, {
          organizationId: workflow.organizationId,
          workspaceId: workflow.workspaceId,
          name: workflow.name,
          description: workflow.description,
          triggerType: workflow.triggerType,
          enabled: workflow.enabled,
          webhookSecret: workflow.webhookSecret,
          scheduleAt: workflow.scheduleAt ? new Date(workflow.scheduleAt) : null,
          scheduleTriggeredAt: workflow.scheduleTriggeredAt ? new Date(workflow.scheduleTriggeredAt) : null,
          steps: workflow.steps,
          createdBy: workflow.createdBy,
        })
      : await createWorkflow({
          id: workflow.id,
          organizationId: workflow.organizationId,
          workspaceId: workflow.workspaceId,
          name: workflow.name,
          description: workflow.description,
          triggerType: workflow.triggerType,
          enabled: workflow.enabled,
          webhookSecret: workflow.webhookSecret,
          scheduleAt: workflow.scheduleAt ? new Date(workflow.scheduleAt) : null,
          scheduleTriggeredAt: workflow.scheduleTriggeredAt ? new Date(workflow.scheduleTriggeredAt) : null,
          steps: workflow.steps,
          createdBy: workflow.createdBy,
          createdAt: new Date(workflow.createdAt),
          updatedAt: new Date(workflow.updatedAt),
        });
    workflowStore.set(workflow.id, { ...workflow, ...persisted });
    return workflowStore.get(workflow.id);
  }
  workflowStore.set(workflow.id, workflow);
  return workflow;
};

const readWorkflowRun = async (runId: string) => {
  if (pool) return getWorkflowRun(runId);
  return workflowRunStore.get(runId) ?? null;
};

const saveRun = async (run: any) => {
  run.updatedAt = new Date().toISOString();
  if (!run.startedAt) run.startedAt = new Date().toISOString();
  if (pool) {
    const existing = await getWorkflowRun(run.id);
    const values = {
      workflowId: run.workflowId,
      organizationId: run.organizationId,
      workspaceId: run.workspaceId,
      startedBy: run.startedBy,
      currentStep: run.currentStep,
      status: normalizeStatus(run.status) as WorkflowRunRecord["status"],
      input: run.input ?? {},
      stepResults: run.stepResults ?? [],
      errors: run.errors ?? [],
      approvalState: run.approvalState ?? null,
      retryState: run.retryState ?? {},
      finalResult: run.finalResult ?? null,
      nextAttemptAt: run.nextAttemptAt ? new Date(run.nextAttemptAt) : null,
      leaseOwner: run.leaseOwner ?? null,
      leaseExpiresAt: run.leaseExpiresAt ? new Date(run.leaseExpiresAt) : null,
      startedAt: run.startedAt ? new Date(run.startedAt) : null,
      completedAt: run.completedAt ? new Date(run.completedAt) : null,
    };
    const persisted = existing
      ? await updateWorkflowRun(run.id, values)
      : await createWorkflowRun({ id: run.id, ...values });
    workflowRunStore.set(run.id, { ...run, ...persisted });
    return workflowRunStore.get(run.id);
  }
  workflowRunStore.set(run.id, run);
  return run;
};

const assertValidStatusTransition = (currentStatus: string, nextStatus: string): void => {
  if (normalizeStatus(currentStatus) === normalizeStatus(nextStatus)) return;
  const allowed = statusTransitions[normalizeStatus(currentStatus)] ?? [];
  if (!allowed.includes(normalizeStatus(nextStatus))) {
    throw new Error(`Invalid workflow state transition from ${normalizeStatus(currentStatus)} to ${normalizeStatus(nextStatus)}`);
  }
};

const setRunStatus = (run: any, nextStatus: string): void => {
  const currentStatus = normalizeStatus(run.status);
  const normalizedNextStatus = normalizeStatus(nextStatus);
  assertValidStatusTransition(currentStatus, normalizedNextStatus);
  run.status = normalizedNextStatus;
};

const getStepResult = (state: any, path: string) => {
  const resolved = getStepPath(state, path);
  return resolved;
};

const executeWorkflowStep = async (step: any, state: Record<string, any>, workflow: any, run: any): Promise<any> => {
  const config = resolveValue(step.input ?? {}, state) ?? {};
  const registry: Record<string, (step: any, config: any, state: Record<string, any>, workflow: any, run: any) => Promise<any> | any> = {
    AI: async (_step, _config, _state) => {
      const prompt = typeof _config.prompt === "string" ? _config.prompt : typeof _config.request === "string" ? _config.request : JSON.stringify(_state);
      return { value: { prompt, response: `AI step ${_step.name ?? _step.id} completed with ${String(Object.keys(_state).length)} inputs.` } };
    },
    TOOL: async (_step, _config, _state) => {
      const toolName = _step.tool ?? _config.tool;
      if (!toolName) throw new Error("Tool step requires a tool name");
      return { value: { tool: toolName, result: { status: "executed", input: _config, state: Object.keys(_state) } } };
    },
    CONDITION: async (_step, _config, _state) => {
      const condition = _step.condition ?? _config.condition ?? {};
      const actual = getStepResult(_state, condition.path ?? "");
      const passed = condition.exists ? actual !== undefined : actual === condition.equals;
      return {
        value: { passed, actual },
        nextStepId: passed ? condition.onTrue : condition.onFalse,
      };
    },
    TRANSFORM: async (_step, _config, _state) => ({ value: resolveValue(_step.transform ?? _config ?? {}, _state) }),
    WAIT: async (_step, _config) => {
      const waitMs = Number(_step.waitMs ?? _config.waitMs ?? _step.durationMs ?? _config.durationMs ?? 1000);
      return { value: { waitMs, waiting: true }, wait: true, resumeAfterMs: Math.max(0, waitMs) };
    },
    APPROVAL: async () => ({ value: { approvalRequired: true }, wait: true, approval: true }),
    WEBHOOK: async (_step, _config, _state) => {
      const url = _step.url ?? _config.url;
      if (!url) throw new Error("Webhook step requires a URL");
      const timeoutMs = Number(_step.timeoutMs ?? _config.timeoutMs ?? 10_000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(typeof _step.idempotencyKey === "string"
              ? { "idempotency-key": _step.idempotencyKey }
              : {}),
          },
          body: JSON.stringify(_config.payload ?? _state),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Webhook timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
      return { value: { status: response.status, ok: true } };
    },
    NOTIFICATION: async (_step, _config) => ({ value: { notified: true, payload: _config } }),
    LOOP: async (_step, _config) => {
      const items = Array.isArray(_config.items) ? _config.items : Array.isArray(_step.items) ? _step.items : [];
      return { value: { iterations: items.length, items } };
    },
  };

  const handler = registry[(step.type ?? "").toUpperCase()];
  if (!handler) throw new Error(`Unsupported workflow step type: ${step.type}`);
  return await handler(step, config, state, workflow, run);
};

const gotWorkItem = async (runId: string): Promise<void> => {
  const activeQueue = workflowQueue.has(runId);
  if (activeQueue) return;
  workflowQueue.add(runId);
  try {
    await processWorkflowRun(runId);
  } finally {
    workflowQueue.delete(runId);
  }
};

const tickWorkflowRun = gotWorkItem;

const processWorkflowRun = async (runId: string) => {
  const run = await readWorkflowRun(runId);
  if (!run || normalizeStatus(run.status) === "CANCELLED") return;
  const workflow = await readWorkflow(run.workflowId);
  if (!workflow) return;

  const currentStatus = normalizeStatus(run.status);
  if (currentStatus === "PAUSED") return;
  if (currentStatus === "WAITING_FOR_APPROVAL") return;
  if (currentStatus === "FAILED" && !workflowRetryQueue.has(run.id)) return;

  const state = { ...(run.input ?? {}), ...(run.finalResult ?? {}) };
  const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  let currentState = { ...state };

  try {
    setRunStatus(run, "RUNNING");
    await saveRun(run);

    let index = Number(run.currentStep ?? 0);
    while (index < steps.length) {
      const step = steps[index];
      if (!step || !step.id || !stepTypes.includes((step.type ?? "").toUpperCase())) {
        throw new Error(`Invalid workflow step at index ${index}`);
      }

      run.currentStep = index;
      run.updatedAt = new Date().toISOString();
      await saveRun(run);

      const execution = await executeWorkflowStep(step, currentState, workflow, run);
      if (execution.wait) {
        setRunStatus(run, execution.approval ? "WAITING_FOR_APPROVAL" : "WAITING");
        run.currentStep = index + 1;
        run.approvalState = execution.approval ? { stepId: step.id, requestedAt: new Date().toISOString() } : run.approvalState ?? null;
        run.nextAttemptAt = execution.resumeAfterMs
          ? new Date(Date.now() + execution.resumeAfterMs).toISOString()
          : null;
        run.updatedAt = new Date().toISOString();
        await saveRun(run);
        if (execution.resumeAfterMs && execution.resumeAfterMs > 0) {
          const existingTimer = workflowTimers.get(run.id);
          if (existingTimer) clearTimeout(existingTimer);
          const timer = setTimeout(() => {
            void (async () => {
              const fresh = await readWorkflowRun(run.id);
              if (fresh && normalizeStatus(fresh.status) === "WAITING") {
                setRunStatus(fresh, "RUNNING");
                fresh.nextAttemptAt = null;
                await saveRun(fresh);
                await gotWorkItem(run.id);
              }
            })();
          }, execution.resumeAfterMs);
          workflowTimers.set(run.id, timer);
        }
        return;
      }

      currentState = { ...currentState, ...(execution.value ?? {}) };
      run.stepResults = Array.isArray(run.stepResults)
        ? [...run.stepResults, { stepId: step.id, type: step.type, value: execution.value ?? null }]
        : [{ stepId: step.id, type: step.type, value: execution.value ?? null }];
      run.input = currentState;
      run.finalResult = currentState;
      run.updatedAt = new Date().toISOString();
      await saveRun(run);

      if (typeof execution.nextStepId === "string") {
        const nextIndex = steps.findIndex((candidate: any) => candidate?.id === execution.nextStepId);
        if (nextIndex < 0) throw new Error(`Condition referenced unknown step: ${execution.nextStepId}`);
        run.currentStep = nextIndex;
      } else {
        run.currentStep = index + 1;
      }
      index = run.currentStep;
    }

    setRunStatus(run, "COMPLETED");
    run.completedAt = new Date().toISOString();
    run.finalResult = currentState;
    run.updatedAt = new Date().toISOString();
    await saveRun(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow execution error";
    const attempts = Number(run.retryState?.attempts ?? 0) + 1;
    run.errors = Array.isArray(run.errors) ? [...run.errors, { message, timestamp: new Date().toISOString() }] : [{ message, timestamp: new Date().toISOString() }];
    run.retryState = {
      ...(run.retryState ?? {}),
      attempts,
      lastError: message,
      lastAttemptAt: new Date().toISOString(),
    };
    run.updatedAt = new Date().toISOString();
    await saveRun(run);

    const maxRetries = 3;
    if (attempts <= maxRetries) {
      setRunStatus(run, "QUEUED");
      run.updatedAt = new Date().toISOString();
      await saveRun(run);
      await queueWorkflowRun(run.id, 1000 * attempts);
      return;
    }

    setRunStatus(run, "FAILED");
    run.completedAt = new Date().toISOString();
    run.updatedAt = new Date().toISOString();
    await saveRun(run);
  }
};

const queueWorkflowRun = async (runId: string, retryDelayMs = 0) => {
  const run = await readWorkflowRun(runId);
  if (!run) return;
  if (retryDelayMs > 0) {
    workflowRetryQueue.set(runId, retryDelayMs);
    setTimeout(() => {
      workflowRetryQueue.delete(runId);
      void gotWorkItem(runId);
    }, retryDelayMs);
    return;
  }
  void gotWorkItem(runId);
};

const evaluateScheduledWorkflows = async () => {
  const workflows = pool ? await listWorkflows() : [...workflowStore.values()];
  for (const workflow of workflows) {
    if ((workflow.triggerType ?? "manual").toLowerCase() !== "scheduled") continue;
    if (workflow.enabled === false) continue;
    const now = Date.now();
    const scheduledAt = workflow.scheduleAt ? new Date(workflow.scheduleAt).getTime() : 0;
    if (!scheduledAt || scheduledAt > now || workflow.scheduleTriggeredAt) continue;
    const allRuns = pool ? await listWorkflowRuns(workflow.id) : [...workflowRunStore.values()];
    const existingRuns = allRuns.filter(
      (run) => run.workflowId === workflow.id && ["QUEUED", "RUNNING", "WAITING", "WAITING_FOR_APPROVAL", "PAUSED"].includes(normalizeStatus(run.status)),
    );
    if (existingRuns.length > 0) continue;

    const run = await saveRun({
      id: makeId("workflow-run"),
      workflowId: workflow.id,
      organizationId: workflow.organizationId,
      workspaceId: workflow.workspaceId,
      startedBy: "scheduler",
      currentStep: 0,
      status: "QUEUED",
      input: { trigger: "scheduled", workflowId: workflow.id },
      stepResults: [],
      errors: [],
      approvalState: null,
      retryState: {},
      finalResult: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });
    workflow.scheduleTriggeredAt = new Date().toISOString();
    await saveWorkflow(workflow);
    await queueWorkflowRun(run.id);
  }
};

const startScheduledWorkflowPoller = () => {
  if (scheduledWorkflowPollerStarted) return;
  scheduledWorkflowPollerStarted = true;
  setInterval(() => {
    void evaluateScheduledWorkflows();
  }, 15000);
};

const startDurableWorkflowWorker = () => {
  if (!pool) return;
  const workerId = `api-worker-${randomUUID()}`;
  setInterval(() => {
    void (async () => {
      const claimed = await claimRunnableWorkflowRuns({
        leaseOwner: workerId,
        leaseExpiresAt: new Date(Date.now() + 30_000),
      });
      await Promise.all(claimed.map((run) => gotWorkItem(run.id)));
    })();
  }, 5_000);
};

router.get("/workflows", async (req, res) => {
  const workflows = pool
    ? (await listWorkflows(
        typeof req.query.organizationId === "string" ? req.query.organizationId : undefined,
        typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined,
      )).map(serializeWorkflow)
    : [...workflowStore.values()].map(serializeWorkflow);
  return res.json(workflows);
});

router.post("/workflows", async (req, res) => {
  const body = req.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const triggerType = typeof body.triggerType === "string" ? body.triggerType.toLowerCase() : "manual";
  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (!name || !steps.length || !["manual", "ai", "scheduled", "event", "webhook"].includes(triggerType)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid workflow name, triggerType and steps are required." } });
  }

  const workflow = await saveWorkflow({
    id: makeId("workflow"),
    organizationId: body.organizationId ?? "org-default",
    workspaceId: body.workspaceId ?? "workspace-default",
    name,
    description: typeof body.description === "string" ? body.description : null,
    triggerType,
    enabled: body.enabled !== false,
    scheduleAt: body.scheduleAt ?? null,
    scheduleTriggeredAt: null,
    createdBy: body.createdBy ?? "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps,
    webhookSecret: body.webhookSecret ?? (triggerType === "webhook" ? randomUUID() : null),
  });

  return res.status(201).json(serializeWorkflow(workflow));
});

router.post("/workflows/:workflowId/runs", async (req, res) => {
  const workflow = await readWorkflow(req.params.workflowId);
  if (!workflow) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow not found." } });
  }

  const run = await saveRun({
    id: makeId("workflow-run"),
    workflowId: workflow.id,
    organizationId: workflow.organizationId,
    workspaceId: workflow.workspaceId,
    startedBy: req.body?.startedBy ?? "system",
    currentStep: 0,
    status: "QUEUED",
    input: req.body?.input ?? {},
    stepResults: [],
    errors: [],
    approvalState: null,
    retryState: {},
    finalResult: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  });

  run.status = "QUEUED";
  await saveRun(run);
  await queueWorkflowRun(run.id);
  return res.status(202).json(serializeWorkflowRun(run));
});

router.get("/workflow-runs/:runId", async (req, res) => {
  const run = await readWorkflowRun(req.params.runId);
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found." } });
  return res.json(serializeWorkflowRun(run));
});

router.post("/workflow-runs/:runId/pause", async (req, res) => {
  const run = await readWorkflowRun(req.params.runId);
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found." } });
  if (normalizeStatus(run.status) !== "RUNNING" && normalizeStatus(run.status) !== "WAITING") {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: "Only running or waiting workflow runs can be paused." } });
  }
  setRunStatus(run, "PAUSED");
  run.updatedAt = new Date().toISOString();
  await saveRun(run);
  return res.json(serializeWorkflowRun(run));
});

router.post("/workflow-runs/:runId/resume", async (req, res) => {
  const run = await readWorkflowRun(req.params.runId);
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found." } });
  if (normalizeStatus(run.status) !== "PAUSED" && normalizeStatus(run.status) !== "WAITING" && normalizeStatus(run.status) !== "WAITING_FOR_APPROVAL") {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: "The workflow run is not resumable in its current state." } });
  }
  setRunStatus(run, "RUNNING");
  run.updatedAt = new Date().toISOString();
  await saveRun(run);
  void gotWorkItem(run.id);
  return res.json(serializeWorkflowRun(run));
});

router.post("/workflow-runs/:runId/approval", async (req, res) => {
  const run = await readWorkflowRun(req.params.runId);
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found." } });
  if (normalizeStatus(run.status) !== "WAITING_FOR_APPROVAL") {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: "The workflow run is not awaiting approval." } });
  }
  const approved = Boolean(req.body?.approved ?? false);
  run.approvalState = {
    approved,
    comment: typeof req.body?.comment === "string" ? req.body.comment : "",
    decidedBy: typeof req.body?.decidedBy === "string" ? req.body.decidedBy : "system",
    decidedAt: new Date().toISOString(),
  };
  setRunStatus(run, approved ? "RUNNING" : "FAILED");
  run.updatedAt = new Date().toISOString();
  if (!approved) run.completedAt = new Date().toISOString();
  await saveRun(run);
  if (approved) void gotWorkItem(run.id);
  return res.json(serializeWorkflowRun(run));
});

router.post("/workflow-runs/:runId/cancel", async (req, res) => {
  const run = await readWorkflowRun(req.params.runId);
  if (!run) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Workflow run not found." } });
  if (normalizeStatus(run.status) === "COMPLETED" || normalizeStatus(run.status) === "FAILED" || normalizeStatus(run.status) === "CANCELLED") {
    return res.status(409).json({ error: { code: "INVALID_STATE", message: "The workflow run is already terminal." } });
  }
  setRunStatus(run, "CANCELLED");
  run.completedAt = new Date().toISOString();
  run.updatedAt = new Date().toISOString();
  await saveRun(run);
  return res.json(serializeWorkflowRun(run));
});

router.post("/workflow-events/:eventType", async (req, res) => {
  const eventType = req.params.eventType;
  const runs: any[] = [];
  for (const workflow of workflowStore.values()) {
    if (workflow.triggerType !== "event" || workflow.enabled === false) continue;
    const run = await saveRun({
      id: makeId("workflow-run"),
      workflowId: workflow.id,
      organizationId: workflow.organizationId,
      workspaceId: workflow.workspaceId,
      startedBy: "event",
      currentStep: 0,
      status: "QUEUED",
      input: { eventType, payload: req.body ?? {} },
      stepResults: [],
      errors: [],
      approvalState: null,
      retryState: {},
      finalResult: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });
    run.status = "QUEUED";
    await saveRun(run);
    runs.push(serializeWorkflowRun(run));
    await queueWorkflowRun(run.id);
  }
  return res.status(202).json({ eventType, runs });
});

router.post("/workflow-webhooks/:workflowId", async (req, res) => {
  const workflow = await readWorkflow(req.params.workflowId);
  const providedSecret = req.headers["x-delta-webhook-secret"] ?? req.headers["X-Delta-Webhook-Secret"];
  if (!workflow || workflow.triggerType !== "webhook") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook workflow not found." } });
  }
  const expectedSecret = typeof workflow.webhookSecret === "string" ? workflow.webhookSecret : "";
  const actualSecret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;
  const secretsMatch =
    expectedSecret.length > 0 &&
    typeof actualSecret === "string" &&
    Buffer.byteLength(expectedSecret) === Buffer.byteLength(actualSecret) &&
    timingSafeEqual(Buffer.from(expectedSecret), Buffer.from(actualSecret));
  if (expectedSecret && !secretsMatch) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid webhook secret." } });
  }
  const run = await saveRun({
    id: makeId("workflow-run"),
    workflowId: workflow.id,
    organizationId: workflow.organizationId,
    workspaceId: workflow.workspaceId,
    startedBy: "webhook",
    currentStep: 0,
    status: "QUEUED",
    input: req.body ?? {},
    stepResults: [],
    errors: [],
    approvalState: null,
    retryState: {},
    finalResult: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  });
  run.status = "QUEUED";
  await saveRun(run);
  await queueWorkflowRun(run.id);
  return res.status(202).json(serializeWorkflowRun(run));
});

startScheduledWorkflowPoller();
startDurableWorkflowWorker();

export default router;
