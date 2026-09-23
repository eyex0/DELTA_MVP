import { pgEnum, pgTable, primaryKey, text, timestamp, uuid, boolean, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const organizationRoleEnum = pgEnum("organization_role", ["delivery_lead", "client_reviewer", "admin"]);
export const membershipRoleEnum = pgEnum("membership_role", ["owner", "admin", "member", "viewer"]);
export const projectStatusEnum = pgEnum("project_status", ["discovery", "in_review", "brd_locked"]);
export const projectMemberRoleEnum = pgEnum("project_member_role", ["owner", "reviewer"]);
export const requirementCategoryEnum = pgEnum("requirement_category", ["functional", "non_functional", "integration"]);
export const requirementPriorityEnum = pgEnum("requirement_priority", ["high", "medium", "low"]);
export const requirementStatusEnum = pgEnum("requirement_status", ["draft", "in_review", "approved", "rejected"]);
export const riskImpactEnum = pgEnum("risk_impact", ["high", "medium", "low"]);
export const discoveryConfidenceEnum = pgEnum("discovery_confidence", ["high", "medium", "low"]);
export const brdStatusEnum = pgEnum("brd_status", ["draft", "ready_for_review", "locked"]);
export const agentRunStatusEnum = pgEnum("agent_run_status", ["queued", "running", "approval_required", "completed", "escalated", "failed", "cancelled"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "in_progress", "completed", "cancelled"]);
export const workflowTriggerEnum = pgEnum("workflow_trigger", ["manual", "ai", "scheduled", "event", "webhook"]);
export const workflowStatusEnum = pgEnum("workflow_status", ["queued", "running", "waiting", "waiting_for_approval", "paused", "completed", "failed", "cancelled"]);
export const workflowStepTypeEnum = pgEnum("workflow_step_type", ["ai", "tool", "condition", "transform", "wait", "approval", "webhook", "notification", "loop"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "paused", "waiting_approval", "completed", "failed", "cancelled"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "expired", "cancelled"]);

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: organizationRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembersTable = pgTable("organization_members", {
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: membershipRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  memberPk: primaryKey({ columns: [table.organizationId, table.userId] }),
}));

export const workspacesTable = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationSlugUnique: uniqueIndex("workspaces_organization_slug_unique").on(table.organizationId, table.slug),
  organizationIdx: index("workspaces_organization_idx").on(table.organizationId, table.createdAt),
}));

export const workspaceMembersTable = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: membershipRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  memberPk: primaryKey({ columns: [table.workspaceId, table.userId] }),
}));

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id),
  clientName: text("client_name").notNull(),
  name: text("name").notNull(),
  objective: text("objective"),
  status: projectStatusEnum("status").notNull().default("discovery"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentsTable = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  activeVersionId: uuid("active_version_id"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("agents_tenant_idx").on(table.organizationId, table.workspaceId, table.updatedAt),
}));

export const agentVersionsTable = pgTable("agent_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agentsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  instructions: text("instructions").notNull(),
  model: text("model").notNull(),
  knowledgeSourceIds: jsonb("knowledge_source_ids").$type<string[]>().notNull().default([]),
  toolNames: jsonb("tool_names").$type<string[]>().notNull().default([]),
  approvalPolicy: jsonb("approval_policy").notNull().default({}),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  agentVersionUnique: uniqueIndex("agent_versions_agent_version_unique").on(table.agentId, table.version),
}));

export const projectMembersTable = pgTable("project_members", {
  id: uuid("id").defaultRandom().notNull(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  roleOnProject: projectMemberRoleEnum("role_on_project").notNull(),
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  projectUserUnique: primaryKey({ columns: [table.projectId, table.userId] }),
}));

export const transcriptsTable = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  rawText: text("raw_text").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const discoveryRunsTable = pgTable("discovery_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  transcriptId: uuid("transcript_id").notNull().references(() => transcriptsTable.id),
  status: text("status").notNull(),
  confidence: discoveryConfidenceEnum("confidence"),
  rawModelOutput: jsonb("raw_model_output"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const requirementsTable = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  discoveryRunId: uuid("discovery_run_id").references(() => discoveryRunsTable.id),
  externalRef: text("external_ref"),
  description: text("description").notNull(),
  category: requirementCategoryEnum("category"),
  priority: requirementPriorityEnum("priority"),
  status: requirementStatusEnum("status").notNull().default("draft"),
  rejectionComment: text("rejection_comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const risksTable = pgTable("risks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  discoveryRunId: uuid("discovery_run_id").references(() => discoveryRunsTable.id),
  description: text("description").notNull(),
  impact: riskImpactEnum("impact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const decisionsTable = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  discoveryRunId: uuid("discovery_run_id").references(() => discoveryRunsTable.id),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const openItemsTable = pgTable("open_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  discoveryRunId: uuid("discovery_run_id").references(() => discoveryRunsTable.id),
  description: text("description").notNull(),
  owner: text("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scopeBoundariesTable = pgTable("scope_boundaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  inScope: text("in_scope").array(),
  outOfScope: text("out_of_scope").array(),
  assumptions: text("assumptions").array(),
  dependencies: text("dependencies").array(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brdSummariesTable = pgTable("brd_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  title: text("title"),
  summary: text("summary"),
  status: brdStatusEnum("status").notNull().default("draft"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: uuid("locked_by").references(() => usersTable.id),
});

export const auditEntriesTable = pgTable("audit_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRunsTable = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  projectId: uuid("project_id").references(() => projectsTable.id),
  agentId: uuid("agent_id").references(() => agentsTable.id),
  agentVersionId: uuid("agent_version_id").references(() => agentVersionsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  request: text("request").notNull(),
  status: agentRunStatusEnum("status").notNull().default("queued"),
  currentStep: integer("current_step").notNull().default(0),
  provider: text("provider"),
  model: text("model"),
  requestId: text("request_id"),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  tokenBudget: integer("token_budget"),
  costBudget: integer("cost_budget"),
  response: text("response"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  organizationStatusIdx: index("agent_runs_organization_status_idx").on(table.organizationId, table.status, table.startedAt),
  userStartedIdx: index("agent_runs_user_started_idx").on(table.userId, table.startedAt),
}));

export const agentStepsTable = pgTable("agent_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => agentRunsTable.id),
  step: integer("step").notNull(),
  eventType: text("event_type").notNull(),
  tool: text("tool"),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalsTable = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id),
  agentRunId: uuid("agent_run_id").notNull().references(() => agentRunsTable.id, { onDelete: "cascade" }),
  requesterId: uuid("requester_id").notNull().references(() => usersTable.id),
  approverId: uuid("approver_id").references(() => usersTable.id),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  input: jsonb("input").notNull().default({}),
  decisionComment: text("decision_comment"),
  executionReference: text("execution_reference"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({
  tenantStatusIdx: index("approvals_tenant_status_idx").on(table.organizationId, table.status, table.requestedAt),
  runIdx: index("approvals_run_idx").on(table.agentRunId),
}));

export const agentMessagesTable = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => agentRunsTable.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  role: text("role").notNull(),
  content: text("content"),
  toolCallId: text("tool_call_id"),
  toolCalls: jsonb("tool_calls"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runSequenceUnique: uniqueIndex("agent_messages_run_sequence_unique").on(table.runId, table.sequence),
  runCreatedIdx: index("agent_messages_run_created_idx").on(table.runId, table.createdAt),
}));

export const tasksTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id),
  title: text("title").notNull(),
  assignedTo: uuid("assigned_to").notNull().references(() => usersTable.id),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  status: taskStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantAssigneeIdx: index("tasks_tenant_assignee_idx").on(table.organizationId, table.assignedTo, table.createdAt),
  projectStatusIdx: index("tasks_project_status_idx").on(table.projectId, table.status, table.updatedAt),
}));

export const executionJobsTable = pgTable("execution_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  workspaceId: text("workspace_id"),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: jobStatusEnum("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  claimIdx: index("execution_jobs_claim_idx").on(table.status, table.availableAt),
  tenantIdx: index("execution_jobs_tenant_idx").on(table.organizationId, table.createdAt),
}));

export const idempotencyKeysTable = pgTable("idempotency_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  scope: text("scope").notNull(),
  key: text("key").notNull(),
  response: jsonb("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scopeKeyUnique: uniqueIndex("idempotency_scope_key_unique").on(table.organizationId, table.scope, table.key),
}));

export const usageEventsTable = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  workspaceId: text("workspace_id"),
  userId: uuid("user_id").references(() => usersTable.id),
  executionId: uuid("execution_id").references(() => agentRunsTable.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantTimeIdx: index("usage_events_tenant_time_idx").on(table.organizationId, table.createdAt),
  executionIdx: index("usage_events_execution_idx").on(table.executionId),
}));

export const featureFlagsTable = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  workspaceId: text("workspace_id"),
  userId: uuid("user_id").references(() => usersTable.id),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lookupIdx: index("feature_flags_lookup_idx").on(table.name, table.organizationId, table.workspaceId, table.userId),
}));

export const workflowsTable = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  workspaceId: text("workspace_id"),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: workflowTriggerEnum("trigger_type").notNull(),
  webhookSecret: text("webhook_secret"),
  enabled: boolean("enabled").notNull().default(true),
  steps: jsonb("steps").notNull(),
  scheduleAt: timestamp("schedule_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowRunsTable = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => workflowsTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  workspaceId: text("workspace_id"),
  startedBy: uuid("started_by").references(() => usersTable.id),
  currentStep: integer("current_step").notNull().default(0),
  status: workflowStatusEnum("status").notNull().default("queued"),
  input: jsonb("input").notNull().default({}),
  stepResults: jsonb("step_results").notNull().default([]),
  errors: jsonb("errors").notNull().default([]),
  approvalState: jsonb("approval_state"),
  retryState: jsonb("retry_state").notNull().default({}),
  finalResult: jsonb("final_result"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Workflow = typeof workflowsTable.$inferSelect;
export type WorkflowRun = typeof workflowRunsTable.$inferSelect;

export type Organization = typeof organizationsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectMember = typeof projectMembersTable.$inferSelect;
export type Transcript = typeof transcriptsTable.$inferSelect;
export type DiscoveryRun = typeof discoveryRunsTable.$inferSelect;
export type RequirementRecord = typeof requirementsTable.$inferSelect;
export type RiskRecord = typeof risksTable.$inferSelect;
export type DecisionRecord = typeof decisionsTable.$inferSelect;
export type OpenItemRecord = typeof openItemsTable.$inferSelect;
export type ScopeBoundary = typeof scopeBoundariesTable.$inferSelect;
export type BrdSummary = typeof brdSummariesTable.$inferSelect;
export type AuditEntry = typeof auditEntriesTable.$inferSelect;
export type AgentRun = typeof agentRunsTable.$inferSelect;
export type AgentStep = typeof agentStepsTable.$inferSelect;
export type AgentMessage = typeof agentMessagesTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type ExecutionJob = typeof executionJobsTable.$inferSelect;
export type UsageEvent = typeof usageEventsTable.$inferSelect;
