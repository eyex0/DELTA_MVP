import { ProcessGraph } from "../domain/process.js";

export interface EvaluationMetrics {
  nodePrecision: number;
  nodeRecall: number;
  transitionPrecision: number;
  transitionRecall: number;
  relationshipAccuracy: number;
  decisionAccuracy: number;
  actorAssignmentAccuracy: number;
  exceptionRecall: number;
  loopAccuracy: number;
  parallelismAccuracy: number;
  completeness: number;
  hallucinationRate: number;
  structuralValidity: number;
  overall: number;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const similarity = (left: string, right: string): number => {
  const a = new Set(normalize(left).split(" ").filter(Boolean));
  const b = new Set(normalize(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / new Set([...a, ...b]).size;
};

function matchNodes(candidate: ProcessGraph, gold: ProcessGraph): Map<string, string> {
  const matches = new Map<string, string>();
  const used = new Set<string>();
  for (const type of ["start", "end"] as const) {
    const source = candidate.nodes.find((node) => node.type === type);
    const target = gold.nodes.find((node) => node.type === type);
    if (source && target) matches.set(source.id, target.id);
  }
  for (const node of candidate.nodes.filter((item) => !["start", "end"].includes(item.type))) {
    let best: { id: string; score: number } | undefined;
    for (const target of gold.nodes.filter((item) => !["start", "end"].includes(item.type))) {
      if (used.has(target.id) || node.type !== target.type) continue;
      const score = similarity(node.name, target.name);
      if (score >= 0.5 && (!best || score > best.score)) best = { id: target.id, score };
    }
    if (best) {
      matches.set(node.id, best.id);
      used.add(best.id);
    }
  }
  return matches;
}

export function compareGraphs(candidate: ProcessGraph, gold: ProcessGraph, valid: boolean): EvaluationMetrics {
  const matches = matchNodes(candidate, gold);
  const candidateNames = candidate.nodes.filter((node) => !["start", "end"].includes(node.type));
  const goldNames = gold.nodes.filter((node) => !["start", "end"].includes(node.type));
  const matchedNodes = matches.size;
  const candidateEdges = candidate.transitions.map((edge) => `${matches.get(edge.from) ?? edge.from}->${matches.get(edge.to) ?? edge.to}|${edge.type}`);
  const goldEdges = new Set(gold.transitions.map((edge) => `${edge.from}->${edge.to}|${edge.type}`));
  const matchedEdges = candidateEdges.filter((edge) => goldEdges.has(edge)).length;
  const nodePrecision = candidateNames.length ? matchedNodes / candidateNames.length : 1;
  const nodeRecall = goldNames.length ? matchedNodes / goldNames.length : 1;
  const transitionPrecision = candidateEdges.length ? matchedEdges / candidateEdges.length : 1;
  const transitionRecall = goldEdges.size ? matchedEdges / goldEdges.size : 1;
  const goldDecisions = gold.nodes.filter((node) => node.type === "decision").length;
  const candidateDecisions = candidate.nodes.filter((node) => node.type === "decision").length;
  const decisionAccuracy = goldDecisions ? Math.min(candidateDecisions, goldDecisions) / goldDecisions : candidateDecisions === 0 ? 1 : 0;
  const exceptionRecall = gold.exceptions.length ? Math.min(candidate.exceptions.length, gold.exceptions.length) / gold.exceptions.length : candidate.exceptions.length === 0 ? 1 : 0;
  const loopAccuracy = gold.loops.length ? Math.min(candidate.loops.length, gold.loops.length) / gold.loops.length : candidate.loops.length === 0 ? 1 : 0;
  const goldParallel = gold.nodes.filter((node) => node.type === "parallel_gateway").length;
  const candidateParallel = candidate.nodes.filter((node) => node.type === "parallel_gateway").length;
  const parallelismAccuracy = goldParallel ? Math.min(candidateParallel, goldParallel) / goldParallel : candidateParallel === 0 ? 1 : 0;
  const goldActors = gold.nodes.filter((node) => node.actorId).length;
  const actorAssignmentAccuracy = goldActors ? candidate.nodes.filter((node) => {
    const target = matches.get(node.id);
    const goldNode = gold.nodes.find((item) => item.id === target);
    const candidateActor = node.actorId ? candidate.actors.find((actor) => actor.id === node.actorId) : undefined;
    const goldActor = goldNode?.actorId ? gold.actors.find((actor) => actor.id === goldNode.actorId) : undefined;
    return Boolean(candidateActor && goldActor && normalize(candidateActor.name) === normalize(goldActor.name));
  }).length / goldActors : 1;
  const completeness = nodeRecall * 0.5 + transitionRecall * 0.5;
  const hallucinationRate = Math.max(0, 1 - nodePrecision);
  const structuralValidity = valid ? 1 : 0;
  const relationshipAccuracy = (transitionPrecision + transitionRecall) / 2;
  const overall = nodePrecision * 0.15 + nodeRecall * 0.15 + relationshipAccuracy * 0.15 + decisionAccuracy * 0.1 + actorAssignmentAccuracy * 0.1 + exceptionRecall * 0.05 + loopAccuracy * 0.05 + parallelismAccuracy * 0.05 + completeness * 0.1 + structuralValidity * 0.1 - hallucinationRate * 0.1;
  return {
    nodePrecision: Number(Math.max(0, Math.min(1, nodePrecision)).toFixed(4)),
    nodeRecall: Number(Math.max(0, Math.min(1, nodeRecall)).toFixed(4)),
    transitionPrecision: Number(Math.max(0, Math.min(1, transitionPrecision)).toFixed(4)),
    transitionRecall: Number(Math.max(0, Math.min(1, transitionRecall)).toFixed(4)),
    relationshipAccuracy: Number(Math.max(0, Math.min(1, relationshipAccuracy)).toFixed(4)),
    decisionAccuracy: Number(Math.max(0, Math.min(1, decisionAccuracy)).toFixed(4)),
    actorAssignmentAccuracy: Number(Math.max(0, Math.min(1, actorAssignmentAccuracy)).toFixed(4)),
    exceptionRecall: Number(Math.max(0, Math.min(1, exceptionRecall)).toFixed(4)),
    loopAccuracy: Number(Math.max(0, Math.min(1, loopAccuracy)).toFixed(4)),
    parallelismAccuracy: Number(Math.max(0, Math.min(1, parallelismAccuracy)).toFixed(4)),
    completeness: Number(Math.max(0, Math.min(1, completeness)).toFixed(4)),
    hallucinationRate: Number(Math.max(0, Math.min(1, hallucinationRate)).toFixed(4)),
    structuralValidity: Number(Math.max(0, Math.min(1, structuralValidity)).toFixed(4)),
    overall: Number(Math.max(0, Math.min(1, overall)).toFixed(4)),
  };
}
