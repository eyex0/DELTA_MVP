import { and, eq, lte, sql } from "drizzle-orm";
import { db, executionJobsTable } from "./index";
import type { ExecutionJob } from "./schema";

export async function enqueueJob(input: {
  organizationId: string;
  workspaceId?: string;
  kind: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}) {
  const [job] = await db.insert(executionJobsTable).values({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    kind: input.kind,
    payload: input.payload ?? {},
    maxAttempts: input.maxAttempts ?? 3,
  }).returning();
  return job;
}

export async function claimJob(workerId: string, kinds?: string[]) {
  const kindFilter = kinds?.length ? sql`and ${executionJobsTable.kind} in (${sql.join(kinds.map((kind) => sql`${kind}`), sql`, `)})` : sql``;
  const result = await db.execute(sql`
    update ${executionJobsTable}
    set status = 'running', locked_at = now(), locked_by = ${workerId},
        attempts = attempts + 1, updated_at = now()
    where id = (
      select id from ${executionJobsTable}
      where status = 'queued' and available_at <= now()
        and attempts < max_attempts ${kindFilter}
      order by available_at, created_at
      for update skip locked
      limit 1
    )
    returning *
  `);
  return result.rows[0] as unknown as ExecutionJob | undefined;
}

export async function completeJob(jobId: string, status: "queued" | "completed" | "failed" | "cancelled", error?: string) {
  await db.update(executionJobsTable).set({
    status,
    lastError: error,
    lockedAt: null,
    lockedBy: null,
    updatedAt: new Date(),
  }).where(eq(executionJobsTable.id, jobId));
}

export async function recoverStaleJobs(staleAfterMs = 5 * 60_000) {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const result = await db.update(executionJobsTable).set({
    status: "queued",
    lockedAt: null,
    lockedBy: null,
    availableAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(executionJobsTable.status, "running"), lte(executionJobsTable.lockedAt, cutoff)));
  return result;
}
