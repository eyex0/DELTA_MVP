import { jsonb, pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type DeltaRequirement = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  source: string;
  priority: string;
  status: string;
  owner: string;
  confidence: number;
  dependencies: string[];
  linkedProcess: string;
  linkedDecision: string;
  linkedOutput: string;
};

export type DeltaAnalysis = {
  id: string;
  projectId: string;
  status: string;
  requirementsAnalyzed: number;
  validated: number;
  ambiguous: number;
  conflicts: number;
  missingDependencies: number;
  risks: string[];
  recommendations: string[];
  openDecisions: string[];
  completedAt: string;
};

export type DeltaApproval = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  source: string;
  status: string;
  requestedAt: string;
  decidedAt: string | null;
  decisionBy: string;
  comment: string;
};

export type DeltaTask = {
  id: string;
  title: string;
  workstream: string;
  owner: string;
  status: string;
  priority: string;
  dependencies: string[];
  sequence: number;
  linkedRequirements: string[];
};

export type DeltaPlan = {
  id: string;
  projectId: string;
  status: string;
  summary: string;
  generatedAt: string;
  tasks: DeltaTask[];
};

export type DeltaActivity = {
  id: string;
  projectId: string;
  timestamp: string;
  actor: string;
  title: string;
  detail: string;
  type: string;
};

export type DeltaTraceability = {
  objective: string;
  source: string;
  requirement: string;
  analysis: string;
  decision: string;
  task: string;
  outcome: string;
};

export type DeltaDiscovery = {
  runId: string;
  status: string;
  summary: string;
  objectives: string[];
  stakeholders: string[];
  assumptions: string[];
  openQuestions: string[];
  risks: string[];
  requirementsCreated: number;
  completedAt: string;
};

export const deltaProjectsTable = pgTable("delta_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  industry: text("industry").notNull(),
  objective: text("objective").notNull(),
  status: text("status").notNull().default("active"),
  lifecycleStage: text("lifecycle_stage").notNull().default("discovery"),
  progress: integer("progress").notNull().default(0),
  requirementsCount: integer("requirements_count").notNull().default(0),
  openDecisions: integer("open_decisions").notNull().default(0),
  risks: integer("risks").notNull().default(0),
  pendingApprovals: integer("pending_approvals").notNull().default(0),
  owner: text("owner").notNull().default("Workspace owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  discovery: jsonb("discovery").$type<DeltaDiscovery | null>(),
  requirements: jsonb("requirements").$type<DeltaRequirement[]>().notNull().default([]),
  analysis: jsonb("analysis").$type<DeltaAnalysis | null>(),
  approvals: jsonb("approvals").$type<DeltaApproval[]>().notNull().default([]),
  plan: jsonb("plan").$type<DeltaPlan | null>(),
  activity: jsonb("activity").$type<DeltaActivity[]>().notNull().default([]),
  traceability: jsonb("traceability").$type<DeltaTraceability[]>().notNull().default([]),
});

export const insertDeltaProjectSchema = createInsertSchema(deltaProjectsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertDeltaProject = z.infer<typeof insertDeltaProjectSchema>;
export type DeltaProject = typeof deltaProjectsTable.$inferSelect;