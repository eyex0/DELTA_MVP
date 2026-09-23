import { ProcessGraph, emptyNode } from "../domain/process.js";
import { validateProcessGraph, ValidationIssue } from "../validation/validator.js";

export interface RepairProposal { id: string; issue: string; action: string; graph: ProcessGraph; }

export function proposeRepairs(graph: ProcessGraph): RepairProposal[] {
  const proposals: RepairProposal[] = [];
  const validation = validateProcessGraph(graph);
  for (const issue of validation.errors) {
    if (issue.code === "END_COUNT") {
      const repaired = structuredClone(graph);
      repaired.nodes.push(emptyNode("N-END-REPAIRED", "end", "Repaired process end"));
      const last = repaired.nodes.find((node) => node.type !== "end");
      if (last) repaired.transitions.push({ id: "T-REPAIRED-END", from: last.id, to: "N-END-REPAIRED", type: "sequence" });
      proposals.push({ id: "REPAIR-END", issue: issue.message, action: "Add a terminal end node and sequence transition.", graph: repaired });
    }
  }
  return proposals;
}

export interface GraphChange { kind: "added" | "removed" | "changed"; entity: "node" | "transition" | "actor" | "rule"; id: string; details: string; }
export function diffGraphs(before: ProcessGraph, after: ProcessGraph): GraphChange[] {
  const changes: GraphChange[] = [];
  const compare = <T extends { id: string }>(entity: GraphChange["entity"], left: T[], right: T[]) => {
    const leftMap = new Map(left.map((item) => [item.id, item]));
    const rightMap = new Map(right.map((item) => [item.id, item]));
    for (const [id, item] of rightMap) {
      if (!leftMap.has(id)) changes.push({ kind: "added", entity, id, details: `${entity} ${id} added` });
      else if (JSON.stringify(leftMap.get(id)) !== JSON.stringify(item)) changes.push({ kind: "changed", entity, id, details: `${entity} ${id} changed` });
    }
    for (const id of leftMap.keys()) if (!rightMap.has(id)) changes.push({ kind: "removed", entity, id, details: `${entity} ${id} removed` });
  };
  compare("node", before.nodes, after.nodes);
  compare("transition", before.transitions, after.transitions);
  compare("actor", before.actors, after.actors);
  compare("rule", before.businessRules, after.businessRules);
  return changes;
}

export function repairIssues(graph: ProcessGraph): ValidationIssue[] {
  return validateProcessGraph(graph).errors;
}
