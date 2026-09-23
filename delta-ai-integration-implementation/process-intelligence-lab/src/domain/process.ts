export const SCHEMA_VERSION = "1.0" as const;

export const ACTOR_TYPES = ["person", "role", "team", "department", "organization", "external_party", "system", "ai_agent"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const NODE_TYPES = ["start", "end", "activity", "decision", "subprocess", "approval", "manual_task", "automated_task", "system_action", "notification", "escalation", "exception", "wait", "parallel_gateway", "merge_gateway"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const TRANSITION_TYPES = ["sequence", "conditional", "parallel", "dependency", "exception", "escalation", "loop", "retry", "handoff", "approval", "rollback"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  description?: string;
}

export interface ProcessNode {
  id: string;
  type: NodeType;
  name: string;
  actorId?: string;
  description?: string;
  inputs: string[];
  outputs: string[];
  conditions: string[];
  metadata?: Record<string, string>;
}

export interface Transition {
  id: string;
  from: string;
  to: string;
  type: TransitionType;
  label?: string;
  condition?: string;
}

export interface BusinessRule {
  id: string;
  description: string;
  condition: string;
  truePath?: string;
  falsePath?: string;
}

export interface ProcessException {
  id: string;
  name: string;
  description: string;
  handling?: string;
  nodeId?: string;
}

export interface ProcessLoop {
  id: string;
  entryNodeId: string;
  backNodeId: string;
  description: string;
  condition?: string;
}

export interface ProcessDecision {
  id: string;
  nodeId: string;
  question: string;
  options: string[];
}

export interface ProcessEvidence {
  id: string;
  source: string;
  quote: string;
  start?: number;
  end?: number;
  confidence?: number;
}

export interface ProcessGraph {
  schemaVersion: typeof SCHEMA_VERSION;
  processId: string;
  title: string;
  actors: Actor[];
  nodes: ProcessNode[];
  transitions: Transition[];
  decisions: ProcessDecision[];
  evidence: ProcessEvidence[];
  businessRules: BusinessRule[];
  exceptions: ProcessException[];
  loops: ProcessLoop[];
  metadata: {
    domain: string;
    source?: string;
    model?: string;
    createdAt: string;
    tags: string[];
  };
}

export function isProcessNodeType(value: string): value is NodeType {
  return (NODE_TYPES as readonly string[]).includes(value);
}

export function isTransitionType(value: string): value is TransitionType {
  return (TRANSITION_TYPES as readonly string[]).includes(value);
}

export function indexNodes(graph: ProcessGraph): ReadonlyMap<string, ProcessNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

export function indexActors(graph: ProcessGraph): ReadonlyMap<string, Actor> {
  return new Map(graph.actors.map((actor) => [actor.id, actor]));
}

export function emptyNode(id: string, type: NodeType, name: string): ProcessNode {
  return { id, type, name, inputs: [], outputs: [], conditions: [] };
}
