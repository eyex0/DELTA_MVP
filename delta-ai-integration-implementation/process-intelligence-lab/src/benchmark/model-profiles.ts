import { createAdapterFromEnvironment } from "../adapters/factory.js";
import { ModelProfile } from "./model-battle.js";

export function configuredModelProfiles(env: Record<string, string | undefined>): ModelProfile[] {
  const generation = { temperature: 0, maxAttempts: 2, promptVersion: "process-graph-v1", schemaVersion: "1.0" };
  const foundry: ModelProfile = env.DELTA_MODEL_PROVIDER === "foundry"
    ? { id: "cloud-foundry-configured", name: "Microsoft Foundry configured deployment", version: env.FOUNDRY_DEPLOYMENT ?? "configured", provider: "microsoft-foundry", modelClass: "cloud_llm", generation, adapter: createAdapterFromEnvironment(env) }
    : { id: "cloud-foundry-configured", name: "Microsoft Foundry configured deployment", version: env.FOUNDRY_DEPLOYMENT ?? "unconfigured", provider: "microsoft-foundry", modelClass: "cloud_llm", generation, unavailableReason: "Foundry credentials are not configured" };
  return [
    { id: "local-deterministic-v1", name: "DELTA deterministic baseline", version: "1.0", provider: "local", modelClass: "local", generation, adapter: createAdapterFromEnvironment({ DELTA_MODEL_PROVIDER: "deterministic" }) },
    foundry,
    { id: "reasoning-model-configured", name: "Reasoning model endpoint", version: env.REASONING_MODEL ?? "unconfigured", provider: env.REASONING_PROVIDER ?? "not-configured", modelClass: "reasoning_model", generation, unavailableReason: env.REASONING_ENDPOINT ? "Reasoning endpoint adapter is not configured in this run" : "REASONING_ENDPOINT is not configured" },
    { id: "open-weight-configured", name: "Open-weight model endpoint", version: env.OPEN_WEIGHT_MODEL ?? "unconfigured", provider: env.OPEN_WEIGHT_PROVIDER ?? "not-configured", modelClass: "open_weight", generation, unavailableReason: env.OPEN_WEIGHT_ENDPOINT ? "Open-weight endpoint adapter is not configured in this run" : "OPEN_WEIGHT_ENDPOINT is not configured" },
  ];
}
