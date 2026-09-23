import { ModelProvider } from "./provider.js";
import { DiscoveryExtraction, DiscoveryExtractionSchema } from "./schema.js";
import { DISCOVERY_SYSTEM_PROMPT, buildDiscoveryPrompt, buildRetryPrompt } from "./prompts.js";

export class AiExtractionError extends Error {
  code = "AI_EXTRACTION_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "AiExtractionError";
  }
}

function parseJsonSafe(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

export async function extractDiscovery(
  transcript: string,
  provider: ModelProvider,
): Promise<DiscoveryExtraction> {
  const prompt = buildDiscoveryPrompt(transcript);
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const currentPrompt = attempt === 0 ? prompt : buildRetryPrompt(prompt, lastError);
    try {
      const output = await provider.generate({
        system: DISCOVERY_SYSTEM_PROMPT,
        prompt: currentPrompt,
        maxTokens: 4096,
        temperature: 0,
      });
      const parsed = parseJsonSafe(output.text);
      const result = DiscoveryExtractionSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      lastError = JSON.stringify(result.error.issues);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "JSON non parsabile";
    }
  }

  throw new AiExtractionError(`Estrazione fallita dopo 2 tentativi: ${lastError}`);
}
