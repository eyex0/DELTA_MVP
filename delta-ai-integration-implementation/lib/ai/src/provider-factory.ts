import type { ModelProvider } from "./provider.js";
import { FoundryProvider } from "./providers/foundry-provider.js";
import { NvidiaProvider } from "./providers/nvidia-provider.js";
import { TieredGateway } from "./tiered-gateway.js";

export type AiProviderName = "foundry" | "nvidia";

export function createConfiguredProvider(name: AiProviderName = (process.env.AI_PROVIDER as AiProviderName | undefined) ?? "foundry"): ModelProvider {
  if (name === "nvidia") return new NvidiaProvider();
  if (name === "foundry") return new FoundryProvider();
  throw new Error(`Unsupported AI provider: ${name}`);
}

export function createConfiguredGateway(name: AiProviderName = (process.env.AI_PROVIDER as AiProviderName | undefined) ?? "foundry"): TieredGateway {
  const primary = createConfiguredProvider(name);
  return new TieredGateway({
    chains: { fast: [primary], strong: [primary] },
    timeoutMs: Number(process.env.AI_GATEWAY_TIMEOUT_MS ?? 30_000),
    maxRetries: Number(process.env.AI_GATEWAY_MAX_RETRIES ?? 1),
  });
}
