import { z } from "zod/v4";

export const PROCESS_SCHEMA_VERSION = "1.0" as const;

export const ActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["person", "role", "team", "department", "organization", "external_party", "system", "ai_agent"]),
  description: z.string().optional(),
});

export const ProcessNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "start", "end", "activity", "decision", "subprocess", "approval", "manual_task",
    "automated_task", "system_action", "notification", "escalation", "exception",
    "wait", "parallel_gateway", "merge_gateway",
  ]),
  name: z.string().min(1),
  actorId: z.string().min(1).optional(),
  description: z.string().optional(),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const TransitionSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["sequence", "conditional", "parallel", "dependency", "exception", "escalation", "loop", "retry", "handoff", "approval", "rollback"]),
  label: z.string().optional(),
  condition: z.string().optional(),
});

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  quote: z.string().min(1),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const DecisionSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()).default([]),
});

export const BusinessRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().min(1),
  truePath: z.string().min(1).optional(),
  falsePath: z.string().min(1).optional(),
});

export const ExceptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  handling: z.string().optional(),
  nodeId: z.string().min(1).optional(),
});

export const LoopSchema = z.object({
  id: z.string().min(1),
  entryNodeId: z.string().min(1),
  backNodeId: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().optional(),
});

export const ProcessGraphSchema = z.object({
  schemaVersion: z.literal(PROCESS_SCHEMA_VERSION).default(PROCESS_SCHEMA_VERSION),
  processId: z.string().min(1),
  title: z.string().min(1),
  metadata: z.object({
    domain: z.string().default("general"),
    difficulty: z.enum(["simple", "intermediate", "complex", "enterprise", "real_world"]).default("simple"),
    createdAt: z.string().optional(),
    source: z.string().optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }).default({ domain: "general", difficulty: "simple", tags: [] }),
  actors: z.array(ActorSchema).default([]),
  nodes: z.array(ProcessNodeSchema),
  transitions: z.array(TransitionSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  businessRules: z.array(BusinessRuleSchema).default([]),
  exceptions: z.array(ExceptionSchema).default([]),
  loops: z.array(LoopSchema).default([]),
  evidence: z.array(EvidenceSchema).default([]),
});

export type Actor = z.infer<typeof ActorSchema>;
export type ProcessNode = z.infer<typeof ProcessNodeSchema>;
export type Node = ProcessNode;
export type Transition = z.infer<typeof TransitionSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;
export type ProcessException = z.infer<typeof ExceptionSchema>;
export type ProcessLoop = z.infer<typeof LoopSchema>;
export type ProcessGraph = z.infer<typeof ProcessGraphSchema>;

export function migrateProcessGraph(input: unknown): ProcessGraph {
  if (!input || typeof input !== "object") {
    throw new Error("Process graph must be an object");
  }
  const source = input as Record<string, unknown>;
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  const nodes = rawNodes.map((node) => {
    const item = node && typeof node === "object" ? node as Record<string, unknown> : {};
    return {
      ...item,
      inputs: Array.isArray(item.inputs) ? item.inputs : [],
      outputs: Array.isArray(item.outputs) ? item.outputs : [],
      conditions: Array.isArray(item.conditions) ? item.conditions : [],
    };
  });
  const rawLoops = Array.isArray(source.loops) ? source.loops : [];
  const loops = rawLoops.map((loop) => {
    const item = loop && typeof loop === "object" ? loop as Record<string, unknown> : {};
    const nodeId = typeof item.nodeId === "string" ? item.nodeId : undefined;
    return {
      ...item,
      ...(item.entryNodeId ? {} : nodeId ? { entryNodeId: nodeId } : {}),
      ...(item.backNodeId ? {} : nodeId ? { backNodeId: nodeId } : {}),
    };
  });
  const metadata = source.metadata && typeof source.metadata === "object"
    ? source.metadata as Record<string, unknown>
    : {};
  return ProcessGraphSchema.parse({
    ...source,
    schemaVersion: source.schemaVersion ?? PROCESS_SCHEMA_VERSION,
    nodes,
    loops,
    metadata: { ...metadata, tags: Array.isArray(metadata.tags) ? metadata.tags : [] },
  });
}
