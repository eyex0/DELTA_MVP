import { BenchmarkCase, BenchmarkSplit } from "./runner.js";
import { ModelAdapter, ModelResponse } from "../adapters/model.js";
import { compareGraphs, EvaluationMetrics } from "../evaluation/metrics.js";
import { validateProcessGraph, ValidationResult } from "../validation/validator.js";

export type ModelClass = "cloud_llm" | "reasoning_model" | "open_weight" | "local";
export type RunStatus = "measured" | "failed" | "unavailable";

export interface ModelProfile {
  id: string;
  name: string;
  version: string;
  provider: string;
  modelClass: ModelClass;
  adapter?: ModelAdapter;
  unavailableReason?: string;
  generation: {
    temperature: number;
    maxAttempts: number;
    promptVersion: string;
    schemaVersion: string;
  };
  costPerMillionInputTokens?: number;
  costPerMillionOutputTokens?: number;
}

export interface ErrorTaxonomy {
  category: "provider_unavailable" | "transport" | "structured_output" | "schema" | "graph_invalid" | "unknown";
  message: string;
}

export interface ModelCaseResult {
  modelId: string;
  modelName: string;
  modelVersion: string;
  provider: string;
  modelClass: ModelClass;
  datasetVersion: string;
  split: BenchmarkSplit;
  promptVersion: string;
  schemaVersion: string;
  generation: ModelProfile["generation"];
  caseId: string;
  status: RunStatus;
  latencyMs: number;
  cost?: number;
  tokenUsage?: ModelResponse["usage"];
  rawOutput?: string;
  parsedGraph?: ModelResponse["graph"];
  validation?: ValidationResult;
  metrics?: EvaluationMetrics;
  error?: ErrorTaxonomy;
}

export interface ModelBattleReport {
  experimentId: string;
  datasetVersion: string;
  split: BenchmarkSplit;
  startedAt: string;
  completedAt: string;
  configuration: {
    caseCount: number;
    evaluationMetrics: string[];
    validation: string;
  };
  profiles: Array<Pick<ModelProfile, "id" | "name" | "version" | "provider" | "modelClass">>;
  results: ModelCaseResult[];
}

function classifyError(error: unknown): ErrorTaxonomy {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const category = lower.includes("requires") || lower.includes("unavailable") || lower.includes("not configured") || lower.includes("credentials") ? "provider_unavailable"
    : lower.includes("json") || lower.includes("structured") ? "structured_output"
    : lower.includes("schema") ? "schema"
    : lower.includes("validation") || lower.includes("node") || lower.includes("transition") ? "graph_invalid"
    : lower.includes("http") || lower.includes("fetch") ? "transport"
    : "unknown";
  return { category, message };
}

export async function runModelBattle(
  profiles: ModelProfile[],
  cases: BenchmarkCase[],
  datasetVersion: string,
  split: BenchmarkSplit,
): Promise<ModelBattleReport> {
  const startedAt = new Date().toISOString();
  const results: ModelCaseResult[] = [];
  for (const profile of profiles) {
    for (const benchmarkCase of cases) {
      if (!profile.adapter) {
        results.push({
          modelId: profile.id, modelName: profile.name, modelVersion: profile.version, provider: profile.provider, modelClass: profile.modelClass,
          datasetVersion, split, promptVersion: profile.generation.promptVersion, schemaVersion: profile.generation.schemaVersion,
          generation: profile.generation, caseId: benchmarkCase.id, status: "unavailable", latencyMs: 0,
          error: classifyError(profile.unavailableReason ?? "Provider unavailable"),
        });
        continue;
      }
      const started = performance.now();
      try {
        const response = await profile.adapter.generate({
          input: benchmarkCase.input,
          schemaVersion: profile.generation.schemaVersion,
          temperature: profile.generation.temperature,
          metadata: { benchmarkCaseId: benchmarkCase.id, promptVersion: profile.generation.promptVersion },
        });
        const validation = validateProcessGraph(response.graph);
        const metrics = compareGraphs(response.graph, benchmarkCase.gold, validation.valid);
        const inputTokens = response.usage?.inputTokens ?? 0;
        const outputTokens = response.usage?.outputTokens ?? 0;
        const cost = profile.costPerMillionInputTokens !== undefined || profile.costPerMillionOutputTokens !== undefined
          ? (inputTokens * (profile.costPerMillionInputTokens ?? 0) + outputTokens * (profile.costPerMillionOutputTokens ?? 0)) / 1_000_000
          : undefined;
        results.push({
          modelId: profile.id, modelName: profile.name, modelVersion: profile.version, provider: profile.provider, modelClass: profile.modelClass,
          datasetVersion, split, promptVersion: profile.generation.promptVersion, schemaVersion: profile.generation.schemaVersion,
          generation: profile.generation, caseId: benchmarkCase.id, status: "measured",
          latencyMs: Math.round(performance.now() - started), ...(cost !== undefined ? { cost } : {}),
          ...(response.usage ? { tokenUsage: response.usage } : {}), ...(response.raw ? { rawOutput: response.raw } : {}),
          parsedGraph: response.graph, validation, metrics,
        });
      } catch (error) {
        results.push({
          modelId: profile.id, modelName: profile.name, modelVersion: profile.version, provider: profile.provider, modelClass: profile.modelClass,
          datasetVersion, split, promptVersion: profile.generation.promptVersion, schemaVersion: profile.generation.schemaVersion,
          generation: profile.generation, caseId: benchmarkCase.id, status: "failed",
          latencyMs: Math.round(performance.now() - started), error: classifyError(error),
        });
      }
    }
  }
  return {
    experimentId: `MODEL-BATTLE-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    datasetVersion, split, startedAt, completedAt: new Date().toISOString(),
    configuration: {
      caseCount: cases.length,
      evaluationMetrics: ["nodePrecision", "nodeRecall", "relationshipAccuracy", "decisionAccuracy", "actorAssignmentAccuracy", "exceptionRecall", "loopAccuracy", "parallelismAccuracy", "structuralValidity", "completeness", "hallucinationRate", "overall", "latencyMs", "cost"],
      validation: "validateProcessGraph v1.0",
    },
    profiles: profiles.map(({ id, name, version, provider, modelClass }) => ({ id, name, version, provider, modelClass })),
    results,
  };
}

export function summarizeModelBattle(report: ModelBattleReport) {
  return report.profiles.map((profile) => {
    const rows = report.results.filter((result) => result.modelId === profile.id);
    const measured = rows.filter((result) => result.status === "measured" && result.metrics);
    const average = (key: keyof EvaluationMetrics) => measured.length ? Number((measured.reduce((sum, row) => sum + Number(row.metrics?.[key] ?? 0), 0) / measured.length).toFixed(4)) : 0;
    return {
      ...profile,
      status: measured.length ? "measured" : rows.some((row) => row.status === "failed") ? "failed" : "unavailable",
      measuredCases: measured.length,
      failedCases: rows.filter((row) => row.status === "failed").length,
      unavailableCases: rows.filter((row) => row.status === "unavailable").length,
      nodePrecision: average("nodePrecision"), nodeRecall: average("nodeRecall"), relationshipAccuracy: average("relationshipAccuracy"),
      decisionAccuracy: average("decisionAccuracy"), actorAssignmentAccuracy: average("actorAssignmentAccuracy"),
      exceptionRecall: average("exceptionRecall"), loopAccuracy: average("loopAccuracy"), parallelismAccuracy: average("parallelismAccuracy"),
      graphValidity: measured.length ? Number((measured.filter((row) => row.validation?.valid).length / measured.length).toFixed(4)) : 0,
      completeness: average("completeness"), hallucinationRate: average("hallucinationRate"), overall: average("overall"),
      averageLatencyMs: measured.length ? Number((measured.reduce((sum, row) => sum + row.latencyMs, 0) / measured.length).toFixed(2)) : 0,
      totalCost: Number(rows.reduce((sum, row) => sum + (row.cost ?? 0), 0).toFixed(8)),
      errors: rows.filter((row) => row.error).reduce<Record<string, number>>((counts, row) => {
        const category = row.error?.category ?? "unknown"; counts[category] = (counts[category] ?? 0) + 1; return counts;
      }, {}),
    };
  });
}

export function modelBattleMarkdown(report: ModelBattleReport): string {
  const summaries = summarizeModelBattle(report);
  const metricKeys = ["nodePrecision", "nodeRecall", "relationshipAccuracy", "decisionAccuracy", "actorAssignmentAccuracy", "exceptionRecall", "loopAccuracy", "parallelismAccuracy", "graphValidity", "completeness", "hallucinationRate", "overall", "averageLatencyMs", "totalCost"] as const;
  const failures = summaries.flatMap((summary) => Object.entries(summary.errors).map(([category, count]) => `| ${summary.name} | ${category} | ${count} |`));
  return [
    "# Model Battle Report",
    "",
    `Experiment: **${report.experimentId}**`,
    `Dataset: **${report.datasetVersion}**, split: **${report.split}**, cases: **${report.configuration.caseCount}**`,
    "",
    `| Model | Class | Status | ${metricKeys.join(" | ")} |`,
    `|---|---|---|${metricKeys.map(() => "---:").join("|")}|`,
    ...summaries.map((summary) => `| ${summary.name} | ${summary.modelClass} | ${summary.status} | ${metricKeys.map((key) => summary[key]).join(" | ")} |`),
    "",
    "## Error breakdown",
    "",
    "| Model | Error category | Count |",
    "|---|---|---:|",
    ...(failures.length ? failures : ["| None | None | 0 |"]),
    "",
    "This report contains measured validation-split results only. Unavailable providers are not treated as failures of model quality.",
    "",
  ].join("\n");
}
