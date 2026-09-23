import { ProcessGraph } from "../domain/process.js";

export interface BpmnConformanceResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBpmnConformance(graph: ProcessGraph): BpmnConformanceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const node of graph.nodes) {
    if (node.type === "parallel_gateway" && graph.transitions.filter((edge) => edge.from === node.id).length < 2) errors.push(`Parallel gateway ${node.id} must have at least two outgoing flows`);
    if (node.type === "merge_gateway" && graph.transitions.filter((edge) => edge.to === node.id).length < 2) errors.push(`Merge gateway ${node.id} must have at least two incoming flows`);
    if (node.type === "decision" && graph.transitions.filter((edge) => edge.from === node.id && edge.type === "conditional").length < 2) errors.push(`Decision ${node.id} must have at least two conditional flows`);
  }
  if (graph.nodes.filter((node) => node.type === "start").length !== 1) errors.push("BPMN process must have exactly one start event");
  if (graph.nodes.filter((node) => node.type === "end").length < 1) errors.push("BPMN process must have at least one end event");
  if (graph.nodes.some((node) => node.type === "activity" && !node.actorId)) warnings.push("Some activities have no lane/actor assignment");
  return { valid: errors.length === 0, errors, warnings };
}
