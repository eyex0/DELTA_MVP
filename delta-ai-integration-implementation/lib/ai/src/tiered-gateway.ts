import type { ModelInput, ModelOutput, ModelProvider } from "./provider.js";

export type ModelTier = "fast" | "strong";

export type TieredGatewayConfig = {
  chains: Record<ModelTier, ModelProvider[]>;
  timeoutMs?: number;
  maxRetries?: number;
};

export class TieredGateway implements ModelProvider {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly config: TieredGatewayConfig) {
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 1;
  }

  async generate(input: ModelInput, tier: ModelTier = "strong"): Promise<ModelOutput> {
    const chain = this.config.chains[tier];
    if (!chain?.length) throw new Error(`No models configured for tier "${tier}"`);
    let lastError: unknown;
    for (const provider of chain) {
      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        try {
          const output = await Promise.race([
            provider.generate(input),
            new Promise<ModelOutput>((_, reject) =>
              setTimeout(() => reject(new Error(`model_timeout:${this.timeoutMs}ms`)), this.timeoutMs),
            ),
          ]);
          if (output.stopReason === "content_filter") {
            lastError = new Error("model_content_filter");
            break;
          }
          return output;
        } catch (error) {
          lastError = error;
        }
      }
    }
    throw new Error(`All models in "${tier}" tier failed: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
  }
}
