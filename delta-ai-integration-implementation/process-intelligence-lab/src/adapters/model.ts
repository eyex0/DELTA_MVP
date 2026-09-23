import { ProcessGraph, SCHEMA_VERSION, ACTOR_TYPES, NODE_TYPES, TRANSITION_TYPES } from "../domain/process.js";
import { validateProcessGraph } from "../validation/validator.js";

export interface ModelRequest {
  input: string;
  schemaVersion: string;
  temperature?: number;
  metadata?: Record<string, string>;
}
export interface ModelResponse {
  graph: ProcessGraph;
  model: string;
  raw?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}
export interface ModelAdapter {
  readonly id: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export function decodeProcessGraph(value: unknown): ProcessGraph {
  if (!value || typeof value !== "object") throw new Error("Model output must be a JSON object");
  const graph = value as Record<string, unknown>;
  const requiredArrays = ["actors", "nodes", "transitions", "decisions", "businessRules", "exceptions", "loops"];
  for (const key of requiredArrays) if (!Array.isArray(graph[key])) throw new Error(`Process graph field ${key} must be an array`);
  if (graph.schemaVersion !== SCHEMA_VERSION || typeof graph.processId !== "string" || typeof graph.title !== "string") {
    throw new Error("Process graph has an invalid schemaVersion, processId, or title");
  }
  for (const actor of graph.actors as unknown[]) {
    const item = actor as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.name !== "string" || !ACTOR_TYPES.includes(item.type as typeof ACTOR_TYPES[number])) throw new Error("Process graph contains an invalid actor");
  }
  for (const node of graph.nodes as unknown[]) {
    const item = node as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.name !== "string" || !NODE_TYPES.includes(item.type as typeof NODE_TYPES[number])) throw new Error("Process graph contains an invalid node");
  }
  for (const transition of graph.transitions as unknown[]) {
    const item = transition as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.from !== "string" || typeof item.to !== "string" || !TRANSITION_TYPES.includes(item.type as typeof TRANSITION_TYPES[number])) throw new Error("Process graph contains an invalid transition");
  }
  return graph as unknown as ProcessGraph;
}

export interface StructuredGenerationClient {
  generate(request: ModelRequest): Promise<{ text: string; model?: string; usage?: ModelResponse["usage"] }>;
}

export class StructuredModelAdapter implements ModelAdapter {
  constructor(
    readonly id: string,
    private readonly client: StructuredGenerationClient,
    private readonly maxAttempts = 2,
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    let lastError = "No response";
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await this.client.generate(request);
        const parsed = decodeProcessGraph(JSON.parse(response.text));
        const validation = validateProcessGraph(parsed);
        if (!validation.valid) {
          lastError = validation.errors.map((issue) => issue.message).join("; ");
          continue;
        }
        return {
          model: response.model ?? this.id,
          graph: parsed,
          raw: response.text,
          ...(response.usage ? { usage: response.usage } : {}),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Structured response parsing failed";
      }
    }
    throw new Error(`Adapter ${this.id} failed after ${this.maxAttempts} attempts: ${lastError}`);
  }
}

export class DeterministicBaselineAdapter implements ModelAdapter {
  readonly id = "deterministic-baseline-v1";
  async generate(request: ModelRequest): Promise<ModelResponse> {
    const sentences = request.input.split(/[.!?\n]+/).map((value) => value.trim()).filter(Boolean);
    const actor = { id: "ACTOR-OPERATIONS", name: "Operations", type: "team" as const };
    const nodes = [
      { id: "N-START", type: "start" as const, name: "Start", inputs: [], outputs: [], conditions: [] },
      ...sentences.map((name, index) => ({
        id: `N-${String(index + 1).padStart(3, "0")}`,
        type: /\b(if|whether|unless)\b/i.test(name) ? "decision" as const : "activity" as const,
        name,
        actorId: actor.id,
        inputs: [],
        outputs: [],
        conditions: [],
      })),
      { id: "N-END", type: "end" as const, name: "End", inputs: [], outputs: [], conditions: [] },
    ];
    const transitions = nodes.slice(0, -1).map((node, index) => ({
      id: `T-${String(index + 1).padStart(3, "0")}`,
      from: node.id,
      to: nodes[index + 1]!.id,
      type: "sequence" as const,
    }));
    return {
      model: this.id,
      graph: {
        schemaVersion: "1.0",
        processId: "PROC-BASELINE",
        title: "Extracted process",
        actors: [actor],
        nodes,
        transitions,
        decisions: [],
        evidence: [],
        businessRules: [],
        exceptions: [],
        loops: [],
        metadata: { domain: "general", source: "text", model: this.id, createdAt: new Date().toISOString(), tags: [] },
      },
    };
  }
}
