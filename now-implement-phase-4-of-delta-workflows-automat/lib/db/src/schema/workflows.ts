import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const workflowTriggerEnum = pgEnum("workflow_trigger", ["manual", "ai", "scheduled", "event", "webhook"]);
export const workflowStatusEnum = pgEnum("workflow_status", [
  "QUEUED",
  "RUNNING",
  "WAITING",
  "WAITING_FOR_APPROVAL",
  "PAUSED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export const workflowStepTypeEnum = pgEnum("workflow_step_type", [
  "AI",
  "TOOL",
  "CONDITION",
  "TRANSFORM",
  "WAIT",
  "APPROVAL",
  "WEBHOOK",
  "NOTIFICATION",
  "LOOP",
]);

export const workflowsTable = pgTable("workflows", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  workspaceId: text("workspace_id"),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: workflowTriggerEnum("trigger_type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  webhookSecret: text("webhook_secret"),
  scheduleAt: timestamp("schedule_at", { withTimezone: true }),
  scheduleTriggeredAt: timestamp("schedule_triggered_at", { withTimezone: true }),
  steps: jsonb("steps").$type<WorkflowStep[]>().notNull().default([]),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIndex: index("workflows_organization_idx").on(table.organizationId),
  scheduleIndex: index("workflows_schedule_idx").on(table.enabled, table.scheduleAt),
}));

export const workflowRunsTable = pgTable("workflow_runs", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflowsTable.id),
  organizationId: text("organization_id").notNull(),
  workspaceId: text("workspace_id"),
  startedBy: text("started_by"),
  currentStep: integer("current_step").notNull().default(0),
  status: workflowStatusEnum("status").notNull().default("QUEUED"),
  input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
  stepResults: jsonb("step_results").$type<WorkflowStepResult[]>().notNull().default([]),
  errors: jsonb("errors").$type<WorkflowError[]>().notNull().default([]),
  approvalState: jsonb("approval_state").$type<WorkflowApprovalState | null>(),
  retryState: jsonb("retry_state").$type<WorkflowRetryState>().notNull().default({}),
  finalResult: jsonb("final_result").$type<Record<string, unknown> | null>(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  workflowIndex: index("workflow_runs_workflow_idx").on(table.workflowId),
  statusIndex: index("workflow_runs_status_idx").on(table.status, table.nextAttemptAt),
  organizationIndex: index("workflow_runs_organization_idx").on(table.organizationId),
}));

export type WorkflowStep = {
  id: string;
  type: (typeof workflowStepTypeEnum.enumValues)[number];
  [key: string]: unknown;
};

export type WorkflowStepResult = {
  stepId: string;
  type: string;
  value: unknown;
};

export type WorkflowError = {
  message: string;
  timestamp: string;
};

export type WorkflowApprovalState = {
  stepId?: string;
  approved?: boolean;
  comment?: string;
  decidedBy?: string;
  requestedAt?: string;
  decidedAt?: string;
};

export type WorkflowRetryState = {
  attempts?: number;
  lastError?: string;
  lastAttemptAt?: string;
};

export type WorkflowRecord = typeof workflowsTable.$inferSelect;
export type WorkflowRunRecord = typeof workflowRunsTable.$inferSelect;
