export type EmbeddedVector = number[];

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddedVector>;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelProvider {
  generate(input: {
    system?: string;
    messages?: ModelMessage[];
    tools?: ModelToolDefinition[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<{
    text: string;
    toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    usage?: ModelUsage;
    stopReason: string;
  }>;
}

export type EmbeddingModelConfig = {
  model: string;
  dimensions: number;
};

export function createDeterministicEmbeddingProvider(dimensions = 128): EmbeddingProvider {
  return {
    async embed(text: string): Promise<number[]> {
      const seed = Array.from(text).reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
      return Array.from({ length: dimensions }, (_, index) => Math.sin((seed + index * 13.17) / 9.7));
    },
  };
}
