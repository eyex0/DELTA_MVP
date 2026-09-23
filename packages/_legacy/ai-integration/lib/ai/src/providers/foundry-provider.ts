import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class FoundryProvider extends OpenAICompatibleProvider {
  constructor(
    endpoint: string = process.env.FOUNDRY_ENDPOINT ?? "",
    apiKey: string = process.env.FOUNDRY_API_KEY ?? "",
    deployment: string = process.env.FOUNDRY_DEPLOYMENT ?? "",
  ) {
    super({
      provider: "microsoft-foundry",
      baseURL: endpoint ? `${endpoint.replace(/\/+$/, "")}/openai/v1` : "",
      apiKey,
      model: deployment,
      timeoutMs: Number(process.env.FOUNDRY_TIMEOUT_MS ?? 30_000),
      headers: { "api-key": apiKey },
    });
  }
}
