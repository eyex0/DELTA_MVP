import OpenAI from "openai";
import type { ModelInput, ModelMessage, ModelOutput, ModelProvider } from "../provider.js";

export type OpenAICompatibleProviderOptions = {
  provider: string;
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export class ProviderRequestError extends Error {
  readonly provider: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { provider: string; status?: number; retryable?: boolean }) {
    super(message);
    this.name = "ProviderRequestError";
    this.provider = options.provider;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

function toMessages(input: ModelInput): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: ModelMessage[] = input.messages
    ? [{ role: "system", content: input.system }, ...input.messages]
    : [{ role: "system", content: input.system }, { role: "user", content: input.prompt ?? "" }];
  return messages.map((message) => {
    if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.toolCalls?.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

export class OpenAICompatibleProvider implements ModelProvider {
  private readonly client: OpenAI;
  readonly provider: string;
  readonly model: string;

  constructor(options: OpenAICompatibleProviderOptions) {
    if (!options.baseURL || !options.apiKey || !options.model) {
      throw new Error(`Missing ${options.provider} configuration. Set its API key, base URL, and model.`);
    }
    this.provider = options.provider;
    this.model = options.model;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL.replace(/\/+$/, ""),
      timeout: options.timeoutMs ?? 30_000,
      defaultHeaders: options.headers,
    });
  }

  async generate(input: ModelInput): Promise<ModelOutput> {
    const startedAt = Date.now();
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: input.maxTokens ?? 4096,
        temperature: input.temperature ?? 0,
        messages: toMessages(input),
        tools: input.tools?.map((tool) => ({
          type: "function" as const,
          function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
        })),
      });
      const message = completion.choices[0]?.message;
      const text = Array.isArray(message?.content)
        ? message.content.filter((part) => part.type === "text").map((part) => (part.type === "text" ? part.text : "")).join("")
        : typeof message?.content === "string" ? message.content : "";
      return {
        text,
        stopReason: completion.choices[0]?.finish_reason ?? "unknown",
        model: completion.model || this.model,
        toolCalls: message?.tool_calls?.map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })),
        usage: completion.usage ? {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
        metadata: {
          provider: this.provider,
          requestId: completion.id,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      const retryable = status === 408 || status === 409 || status === 429 || (status !== undefined && status >= 500) ||
        (error instanceof Error && /timeout|network|fetch|socket/i.test(error.message));
      const message = status === 401 || status === 403
        ? `${this.provider} authentication failed`
        : status === 404
          ? `${this.provider} model or endpoint was not found`
          : status === 429
            ? `${this.provider} rate limit exceeded`
            : error instanceof Error ? error.message : `${this.provider} request failed`;
      throw new ProviderRequestError(message, { provider: this.provider, status, retryable });
    }
  }

  async *stream(input: ModelInput): AsyncIterable<Partial<ModelOutput>> {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: input.maxTokens ?? 4096,
        temperature: input.temperature ?? 0,
        messages: toMessages(input),
        tools: input.tools?.map((tool) => ({
          type: "function" as const,
          function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
        })),
        stream: true,
        stream_options: { include_usage: true },
      });
      const toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const text = delta?.content ?? "";
        for (const call of delta?.tool_calls ?? []) {
          const current = toolCalls.get(call.index) ?? { id: call.id ?? "", name: "", arguments: "" };
          current.id ||= call.id ?? "";
          current.name += call.function?.name ?? "";
          current.arguments += call.function?.arguments ?? "";
          toolCalls.set(call.index, current);
        }
        yield {
          text,
          stopReason: chunk.choices[0]?.finish_reason ?? "streaming",
          model: chunk.model || this.model,
          toolCalls: toolCalls.size ? [...toolCalls.values()] : undefined,
          usage: chunk.usage ? {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          } : undefined,
          metadata: { provider: this.provider, requestId: chunk.id },
        };
      }
  }
}
