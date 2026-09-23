import { ProcessGraph } from "../domain/process.js";

export interface Ontology {
  synonyms: Record<string, string[]>;
}

export const defaultOntology: Ontology = {
  synonyms: {
    receive: ["accept", "submit", "file", "capture"],
    validate: ["verify", "check", "inspect", "confirm"],
    notify: ["inform", "tell", "send"],
    approve: ["authorize", "accept"],
    reject: ["decline", "deny"],
    complete: ["finish", "close", "resolve"],
  },
};

export function normalizeWithOntology(value: string, ontology = defaultOntology): string {
  const words = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  return words.map((word) => Object.entries(ontology.synonyms).find(([, aliases]) => aliases.includes(word))?.[0] ?? word).join(" ");
}

export function createSemanticKey(graph: ProcessGraph, nodeId: string, ontology = defaultOntology): string {
  const node = graph.nodes.find((item) => item.id === nodeId);
  return node ? `${node.type}:${normalizeWithOntology(node.name, ontology)}` : nodeId;
}
