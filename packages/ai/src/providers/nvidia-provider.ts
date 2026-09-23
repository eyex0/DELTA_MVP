import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class NvidiaProvider extends OpenAICompatibleProvider {
  constructor(
    apiKey: string = process.env.NVIDIA_API_KEY ?? "",
    baseURL: string = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    model: string = process.env.NVIDIA_MODEL ?? "nvidia/llama-3.1-nemotron-70b-instruct",
  ) {
    super({
      provider: "nvidia-nim",
      baseURL,
      apiKey,
      model,
      timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS ?? 30_000),
    });
  }
}
