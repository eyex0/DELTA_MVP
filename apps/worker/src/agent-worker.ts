import { runWorker } from "@workspace/db";
import { processAgentJob } from "./agent-job";
import { validateProductionConfig } from "./production-config";

validateProductionConfig();

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

await runWorker({
  workerId: process.env.WORKER_ID ?? `agent-worker-${process.pid}`,
  handlers: { "agent.execution": processAgentJob },
  signal: controller.signal,
});
