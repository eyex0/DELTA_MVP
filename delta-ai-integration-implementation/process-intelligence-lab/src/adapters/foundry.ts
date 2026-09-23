import { ModelAdapter, ModelRequest, ModelResponse, StructuredGenerationClient, StructuredModelAdapter } from "./model.js";

export interface FoundryAdapterOptions {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion?: string;
  systemPrompt?: string;
}

export class FoundryStructuredClient implements StructuredGenerationClient {
  constructor(private readonly options: FoundryAdapterOptions) {}

  async generate(request: ModelRequest): Promise<{ text: string; model?: string; usage?: ModelResponse["usage"] }> {
    const url = new URL(`${this.options.endpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(this.options.deployment)}/chat/completions`);
    url.searchParams.set("api-version", this.options.apiVersion ?? "2024-10-21");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": this.options.apiKey },
      body: JSON.stringify({
        temperature: request.temperature ?? 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: this.options.systemPrompt ?? "Return only a canonical DELTA ProcessGraph JSON object." },
          { role: "user", content: request.input },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Foundry request failed with HTTP ${response.status}: ${await response.text()}`);
    const body = await response.json() as { model?: string; choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new Error("Foundry response did not contain a completion");
    const usage = body.usage ? {
      ...(body.usage.prompt_tokens !== undefined ? { inputTokens: body.usage.prompt_tokens } : {}),
      ...(body.usage.completion_tokens !== undefined ? { outputTokens: body.usage.completion_tokens } : {}),
    } : undefined;
    return {
      text,
      ...(body.model ? { model: body.model } : {}),
      ...(usage ? { usage } : {}),
    };
  }
}

export function createFoundryAdapter(options: FoundryAdapterOptions): ModelAdapter {
  return new StructuredModelAdapter("microsoft-foundry", new FoundryStructuredClient(options));
}
