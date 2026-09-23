import { ModelAdapter, DeterministicBaselineAdapter } from "./model.js";
import { createFoundryAdapter } from "./foundry.js";

export function createAdapterFromEnvironment(env: Record<string, string | undefined>): ModelAdapter {
  const provider = env.DELTA_MODEL_PROVIDER ?? "deterministic";
  if (provider === "deterministic") return new DeterministicBaselineAdapter();
  if (provider === "foundry") {
    const endpoint = env.FOUNDRY_ENDPOINT;
    const apiKey = env.FOUNDRY_API_KEY;
    const deployment = env.FOUNDRY_DEPLOYMENT;
    if (!endpoint || !apiKey || !deployment) throw new Error("Foundry requires FOUNDRY_ENDPOINT, FOUNDRY_API_KEY, and FOUNDRY_DEPLOYMENT");
    return createFoundryAdapter({ endpoint, apiKey, deployment, ...(env.FOUNDRY_API_VERSION ? { apiVersion: env.FOUNDRY_API_VERSION } : {}) });
  }
  throw new Error(`Unsupported DELTA_MODEL_PROVIDER: ${provider}`);
}
