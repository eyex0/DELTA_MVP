import { ProcessGraph } from "../domain/process.js";
import { diffGraphs, GraphChange } from "./repair.js";

export interface ProcessVersion {
  version: string;
  graph: ProcessGraph;
  createdAt: string;
  author?: string;
  message?: string;
}

export interface VersionComparison {
  from: string;
  to: string;
  changes: GraphChange[];
}

export function createProcessVersion(graph: ProcessGraph, version: string, author?: string, message?: string): ProcessVersion {
  return { version, graph: structuredClone(graph), createdAt: new Date().toISOString(), ...(author ? { author } : {}), ...(message ? { message } : {}) };
}

export function compareVersions(from: ProcessVersion, to: ProcessVersion): VersionComparison {
  return { from: from.version, to: to.version, changes: diffGraphs(from.graph, to.graph) };
}
