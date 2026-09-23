import { claimJob, completeJob, recoverStaleJobs } from "./queue";
import type { ExecutionJob } from "./schema";

export type JobHandler = (job: ExecutionJob) => Promise<void>;

const reliabilityFailures = new Map<string, { count: number; openedAt?: number }>();

export function withReliability(jobType: string, handler: JobHandler): JobHandler {
  return async (job) => {
    const state = reliabilityFailures.get(jobType) ?? { count: 0 };
    if (state.openedAt && Date.now() - state.openedAt < 30_000) {
      throw new Error(`circuit_open:${jobType}`);
    }
    if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
      throw new Error(`poison_pill:${jobType}`);
    }
    try {
      await Promise.race([
        handler(job),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("job_timeout:60000ms")), 60_000)),
      ]);
      reliabilityFailures.set(jobType, { count: 0 });
    } catch (error) {
      const count = state.count + 1;
      reliabilityFailures.set(jobType, { count, openedAt: count >= 5 ? Date.now() : undefined });
      throw error;
    }
  };
}

export async function runWorker(options: {
  workerId: string;
  handlers: Record<string, JobHandler>;
  signal?: AbortSignal;
  pollMs?: number;
}) {
  const pollMs = options.pollMs ?? 1_000;
  while (!options.signal?.aborted) {
    await recoverStaleJobs();
    const job = await claimJob(options.workerId, Object.keys(options.handlers));
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    const handler = withReliability(job.kind, options.handlers[job.kind]);
    try {
      await handler(job);
      await completeJob(job.id, "completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      await completeJob(job.id, job.attempts >= job.maxAttempts ? "failed" : "queued", message);
    }
  }
}
