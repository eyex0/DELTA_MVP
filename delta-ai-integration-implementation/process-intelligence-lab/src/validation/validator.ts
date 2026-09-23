import { NODE_TYPES, ProcessGraph, SCHEMA_VERSION, TRANSITION_TYPES } from "../domain/process.js";

export type IssueSeverity = "error" | "warning";
export interface ValidationIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  path?: string;
}
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

export function validateProcessGraph(graph: ProcessGraph): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const nodeIds = graph.nodes.map((node) => node.id);
  const nodeSet = new Set(nodeIds);
  const actorIds = graph.actors.map((actor) => actor.id);
  const actorSet = new Set(actorIds);
  const transitionIds = graph.transitions.map((edge) => edge.id);

  if (graph.schemaVersion !== SCHEMA_VERSION) errors.push({ code: "SCHEMA_VERSION", severity: "error", message: `Unsupported schema version: ${graph.schemaVersion}` });
  for (const id of duplicates(nodeIds)) errors.push({ code: "DUPLICATE_NODE_ID", severity: "error", message: `Duplicate node ID: ${id}` });
  for (const id of duplicates(transitionIds)) errors.push({ code: "DUPLICATE_TRANSITION_ID", severity: "error", message: `Duplicate transition ID: ${id}` });
  for (const id of duplicates(actorIds)) errors.push({ code: "DUPLICATE_ACTOR_ID", severity: "error", message: `Duplicate actor ID: ${id}` });

  const starts = graph.nodes.filter((node) => node.type === "start");
  const ends = graph.nodes.filter((node) => node.type === "end");
  if (starts.length !== 1) errors.push({ code: "START_COUNT", severity: "error", message: `Expected exactly one start node, found ${starts.length}` });
  if (ends.length < 1) errors.push({ code: "END_COUNT", severity: "error", message: "At least one end node is required" });

  for (const node of graph.nodes) {
    if (!NODE_TYPES.includes(node.type)) errors.push({ code: "NODE_TYPE", severity: "error", message: `Unknown node type: ${node.type}`, path: `nodes.${node.id}.type` });
    if (!node.name.trim()) errors.push({ code: "EMPTY_NODE_NAME", severity: "error", message: `Node ${node.id} has an empty name` });
    if (node.actorId && !actorSet.has(node.actorId)) errors.push({ code: "ACTOR_REFERENCE", severity: "error", message: `Node ${node.id} references missing actor ${node.actorId}` });
  }

  const outgoing = new Map<string, string[]>();
  for (const edge of graph.transitions) {
    if (!TRANSITION_TYPES.includes(edge.type)) errors.push({ code: "TRANSITION_TYPE", severity: "error", message: `Unknown transition type: ${edge.type}`, path: `transitions.${edge.id}.type` });
    if (!nodeSet.has(edge.from)) errors.push({ code: "MISSING_SOURCE", severity: "error", message: `Transition ${edge.id} references missing source ${edge.from}` });
    if (!nodeSet.has(edge.to)) errors.push({ code: "MISSING_TARGET", severity: "error", message: `Transition ${edge.id} references missing target ${edge.to}` });
    if (edge.from === edge.to && edge.type !== "loop" && edge.type !== "retry") errors.push({ code: "UNDECLARED_SELF_LOOP", severity: "error", message: `Transition ${edge.id} is a self-loop but is not typed as loop or retry` });
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    if (edge.type === "conditional" && !edge.condition && !edge.label) warnings.push({ code: "UNLABELED_BRANCH", severity: "warning", message: `Conditional transition ${edge.id} has no condition or label` });
  }

  if (starts.length === 1) {
    const reachable = new Set<string>();
    const pending = [starts[0]!.id];
    while (pending.length) {
      const current = pending.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      pending.push(...(outgoing.get(current) ?? []));
    }
    for (const node of graph.nodes) {
      if (!reachable.has(node.id)) errors.push({ code: "UNREACHABLE_NODE", severity: "error", message: `Node ${node.id} is unreachable from the start node` });
    }
    const endReachable = new Set<string>();
    const reverse = new Map<string, string[]>();
    for (const edge of graph.transitions) reverse.set(edge.to, [...(reverse.get(edge.to) ?? []), edge.from]);
    const pendingEnds = ends.map((node) => node.id);
    while (pendingEnds.length) {
      const current = pendingEnds.pop()!;
      if (endReachable.has(current)) continue;
      endReachable.add(current);
      pendingEnds.push(...(reverse.get(current) ?? []));
    }
    for (const node of graph.nodes) {
      if (!endReachable.has(node.id) && !["end"].includes(node.type)) errors.push({ code: "NON_TERMINATING_NODE", severity: "error", message: `Node ${node.id} cannot reach an end node` });
    }
  }

  for (const node of graph.nodes.filter((item) => item.type === "decision")) {
    const branches = graph.transitions.filter((edge) => edge.from === node.id && edge.type === "conditional");
    if (branches.length < 2) errors.push({ code: "INCOMPLETE_DECISION", severity: "error", message: `Decision ${node.id} must have at least two conditional branches` });
    if (branches.length >= 2 && new Set(branches.map((edge) => edge.label ?? edge.condition ?? "")).size !== branches.length) {
      errors.push({ code: "DUPLICATE_DECISION_BRANCH", severity: "error", message: `Decision ${node.id} has duplicate branch labels` });
    }
  }
  for (const loop of graph.loops) {
    if (!nodeSet.has(loop.entryNodeId) || !nodeSet.has(loop.backNodeId)) errors.push({ code: "LOOP_REFERENCE", severity: "error", message: `Loop ${loop.id} references a missing node` });
  }
  for (const rule of graph.businessRules) {
    if (rule.truePath && !nodeSet.has(rule.truePath)) errors.push({ code: "RULE_TRUE_PATH", severity: "error", message: `Rule ${rule.id} references missing true path ${rule.truePath}` });
    if (rule.falsePath && !nodeSet.has(rule.falsePath)) errors.push({ code: "RULE_FALSE_PATH", severity: "error", message: `Rule ${rule.id} references missing false path ${rule.falsePath}` });
  }
  for (const exception of graph.exceptions) {
    if (exception.nodeId && !nodeSet.has(exception.nodeId)) errors.push({ code: "EXCEPTION_REFERENCE", severity: "error", message: `Exception ${exception.id} references missing node ${exception.nodeId}` });
  }
  if (!graph.businessRules.length) warnings.push({ code: "NO_RULES", severity: "warning", message: "No business rules are present" });

  return { valid: errors.length === 0, errors, warnings };
}
