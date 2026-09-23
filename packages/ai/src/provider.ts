export type ModelMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content?: string; toolCalls?: ModelToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelInput {
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  tools?: ModelToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface ModelOutput {
  text: string;
  stopReason: string;
  toolCalls?: ModelToolCall[];
  usage?: ModelUsage;
  model?: string;
  metadata?: {
    provider?: string;
    requestId?: string;
    latencyMs?: number;
  };
}

export interface ModelProvider {
  generate(input: ModelInput): Promise<ModelOutput>;
  stream?(input: ModelInput): AsyncIterable<Partial<ModelOutput>>;
}
