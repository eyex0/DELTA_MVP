import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import {
  db,
  workflowRunsTable,
  workflowsTable,
  type WorkflowRecord,
  type WorkflowRunRecord,
} from "./index";

export type WorkflowRunClaim = {
  leaseOwner: string;
  leaseExpiresAt: Date;
};

export const createWorkflow = async (
  values: typeof workflowsTable.$inferInsert,
): Promise<WorkflowRecord> => {
  const [workflow] = await db.insert(workflowsTable).values(values).returning();
  if (!workflow) throw new Error("Workflow creation did not return a record");
  return workflow;
};

export const getWorkflow = async (id: string): Promise<WorkflowRecord | null> => {
  const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id)).limit(1);
  return workflow ?? null;
};

export const updateWorkflow = async (
  id: string,
  values: Partial<typeof workflowsTable.$inferInsert>,
): Promise<WorkflowRecord> => {
  const [workflow] = await db
    .update(workflowsTable)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(workflowsTable.id, id))
    .returning();
  if (!workflow) throw new Error("Workflow was not found");
  return workflow;
};

export const listWorkflows = async (
  organizationId?: string,
  workspaceId?: string,
): Promise<WorkflowRecord[]> => {
  const filters = [];
  if (organizationId) filters.push(eq(workflowsTable.organizationId, organizationId));
  if (workspaceId) filters.push(eq(workflowsTable.workspaceId, workspaceId));
  const query = db.select().from(workflowsTable);
  return filters.length > 0
    ? query.where(and(...filters)).orderBy(asc(workflowsTable.createdAt))
    : query.orderBy(asc(workflowsTable.createdAt));
};

export const listWorkflowRuns = async (workflowId?: string): Promise<WorkflowRunRecord[]> => {
  const query = db.select().from(workflowRunsTable);
  return workflowId
    ? query.where(eq(workflowRunsTable.workflowId, workflowId)).orderBy(asc(workflowRunsTable.updatedAt))
    : query.orderBy(asc(workflowRunsTable.updatedAt));
};

export const createWorkflowRun = async (
  values: typeof workflowRunsTable.$inferInsert,
): Promise<WorkflowRunRecord> => {
  const [run] = await db.insert(workflowRunsTable).values(values).returning();
  if (!run) throw new Error("Workflow run creation did not return a record");
  return run;
};

export const getWorkflowRun = async (id: string): Promise<WorkflowRunRecord | null> => {
  const [run] = await db.select().from(workflowRunsTable).where(eq(workflowRunsTable.id, id)).limit(1);
  return run ?? null;
};

export const updateWorkflowRun = async (
  id: string,
  values: Partial<typeof workflowRunsTable.$inferInsert>,
): Promise<WorkflowRunRecord> => {
  const [run] = await db
    .update(workflowRunsTable)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(workflowRunsTable.id, id))
    .returning();
  if (!run) throw new Error("Workflow run was not found");
  return run;
};

export const claimRunnableWorkflowRuns = async (
  claim: WorkflowRunClaim,
  limit = 10,
): Promise<WorkflowRunRecord[]> => {
  const now = new Date();
  const claimable = or(
    eq(workflowRunsTable.status, "QUEUED"),
    and(
      eq(workflowRunsTable.status, "WAITING"),
      lte(workflowRunsTable.nextAttemptAt, now),
    ),
    and(
      eq(workflowRunsTable.status, "RUNNING"),
      lte(workflowRunsTable.leaseExpiresAt, now),
    ),
  );

  const candidates = await db
    .select({ id: workflowRunsTable.id })
    .from(workflowRunsTable)
    .where(claimable)
    .orderBy(asc(workflowRunsTable.updatedAt))
    .limit(limit);
  if (candidates.length === 0) return [];

  const ids = candidates.map((candidate: { id: string }) => candidate.id);
  return db
    .update(workflowRunsTable)
    .set({
      status: "RUNNING",
      leaseOwner: claim.leaseOwner,
      leaseExpiresAt: claim.leaseExpiresAt,
      updatedAt: now,
    })
    .where(inArray(workflowRunsTable.id, ids))
    .returning();
};
