import { ModelAdapter } from "../adapters/model.js";
import { ProcessGraph } from "../domain/process.js";
import { compareGraphs, EvaluationMetrics } from "../evaluation/metrics.js";
import { validateProcessGraph } from "../validation/validator.js";
import { validateBpmnConformance } from "../validation/bpmn.js";

export interface BenchmarkCase {
  id: string;
  domain: string;
  difficulty: "simple" | "intermediate" | "complex" | "enterprise";
  input: string;
  gold: ProcessGraph;
  expectedRelationships: Array<{ from: string; to: string; type: string; label?: string }>;
  annotations: {
    ambiguity: string[];
    assumptions: string[];
    qualityStatus: "draft" | "reviewed";
    reviewer: string;
  };
}
export type BenchmarkSplit = "train" | "validation" | "test" | "challenge";
export interface BenchmarkManifest {
  version: string;
  cases: Array<BenchmarkCase & { split: BenchmarkSplit }>;
}

export function validateBenchmarkManifest(manifest: BenchmarkManifest): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of manifest.cases) {
    if (ids.has(item.id)) errors.push(`Duplicate benchmark case ID: ${item.id}`);
    ids.add(item.id);
    if (!["train", "validation", "test", "challenge"].includes(item.split)) errors.push(`Invalid split for ${item.id}: ${item.split}`);
    if (!item.input.trim()) errors.push(`Benchmark case ${item.id} has empty input`);
    if (!item.gold) errors.push(`Benchmark case ${item.id} has no gold graph`);
    if (!Array.isArray(item.expectedRelationships) || item.expectedRelationships.length === 0) errors.push(`Benchmark case ${item.id} has no expected relationships`);
    if (!item.annotations || item.annotations.qualityStatus !== "reviewed" || !item.annotations.reviewer) errors.push(`Benchmark case ${item.id} is not quality-reviewed`);
    if (item.expectedRelationships.length !== item.gold.transitions.length) errors.push(`Benchmark case ${item.id} relationship annotation count does not match gold graph`);
  }
  if (!manifest.cases.some((item) => item.split === "test")) errors.push("Benchmark manifest must contain a test split");
  if (!manifest.cases.some((item) => item.split === "challenge")) errors.push("Benchmark manifest must contain a challenge split");
  return errors;
}

export function validateBenchmarkQuality(manifest: BenchmarkManifest): string[] {
  const errors = validateBenchmarkManifest(manifest);
  const splitCounts = new Map<string, number>();
  for (const item of manifest.cases) {
    splitCounts.set(item.split, (splitCounts.get(item.split) ?? 0) + 1);
    const nodeTypes = new Set(item.gold.nodes.map((node) => node.type));
    if (!nodeTypes.has("decision")) errors.push(`Case ${item.id} gold graph has no decision`);
    if (!nodeTypes.has("parallel_gateway")) errors.push(`Case ${item.id} gold graph has no parallel gateway`);
    if (!item.gold.loops.length) errors.push(`Case ${item.id} gold graph has no loop annotation`);
    if (!item.gold.exceptions.length) errors.push(`Case ${item.id} gold graph has no exception annotation`);
    if (!item.gold.businessRules.length) errors.push(`Case ${item.id} gold graph has no business rules`);
    if (!item.annotations.ambiguity.length) errors.push(`Case ${item.id} has no ambiguity annotation`);
    const graphValidation = validateProcessGraph(item.gold);
    if (!graphValidation.valid) errors.push(`Case ${item.id} gold graph is invalid: ${graphValidation.errors.map((issue) => issue.code).join(", ")}`);
    const bpmnValidation = validateBpmnConformance(item.gold);
    if (!bpmnValidation.valid) errors.push(`Case ${item.id} fails BPMN conformance: ${bpmnValidation.errors.join("; ")}`);
  }
  if ((splitCounts.get("train") ?? 0) < 50) errors.push("Train split must contain at least 50 cases");
  if ((splitCounts.get("validation") ?? 0) < 10) errors.push("Validation split must contain at least 10 cases");
  if ((splitCounts.get("test") ?? 0) < 10) errors.push("Test split must contain at least 10 cases");
  if ((splitCounts.get("challenge") ?? 0) < 5) errors.push("Challenge split must contain at least 5 cases");
  return errors;
}

export function selectBenchmarkSplit(manifest: BenchmarkManifest, split: BenchmarkSplit): BenchmarkCase[] {
  return manifest.cases.filter((item) => item.split === split);
}
export interface BenchmarkResult extends EvaluationMetrics {
  caseId: string;
  model: string;
  valid: boolean;
  durationMs: number;
  error?: string;
}

export interface BenchmarkSummary {
  model: string;
  split: BenchmarkSplit | "all";
  cases: number;
  validCases: number;
  averageOverall: number;
  averageLatencyMs: number;
  failureRate: number;
}

export function summarizeBenchmark(results: BenchmarkResult[], split: BenchmarkSummary["split"] = "all"): BenchmarkSummary {
  const average = (values: number[]) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)) : 0;
  return {
    model: results[0]?.model ?? "unknown",
    split,
    cases: results.length,
    validCases: results.filter((result) => result.valid).length,
    averageOverall: average(results.map((result) => result.overall)),
    averageLatencyMs: average(results.map((result) => result.durationMs)),
    failureRate: results.length ? Number((results.filter((result) => result.error).length / results.length).toFixed(4)) : 0,
  };
}

export async function runBenchmark(adapter: ModelAdapter, cases: BenchmarkCase[]): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  for (const benchmarkCase of cases) {
    const started = performance.now();
    try {
      const response = await adapter.generate({ input: benchmarkCase.input, schemaVersion: "1.0", metadata: { benchmarkCaseId: benchmarkCase.id } });
      const validation = validateProcessGraph(response.graph);
      results.push({ caseId: benchmarkCase.id, model: response.model, valid: validation.valid, durationMs: Math.round(performance.now() - started), ...compareGraphs(response.graph, benchmarkCase.gold, validation.valid) });
    } catch (error) {
      results.push({
        caseId: benchmarkCase.id,
        model: adapter.id,
        valid: false,
        durationMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : "Adapter failed",
        nodePrecision: 0, nodeRecall: 0, transitionPrecision: 0, transitionRecall: 0,
        relationshipAccuracy: 0, decisionAccuracy: 0, actorAssignmentAccuracy: 0,
        exceptionRecall: 0, loopAccuracy: 0, parallelismAccuracy: 0, completeness: 0,
        hallucinationRate: 1, structuralValidity: 0, overall: 0,
      });
    }
  }
  return results;
}
