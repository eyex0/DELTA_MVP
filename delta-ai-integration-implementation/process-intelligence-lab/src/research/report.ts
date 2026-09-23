import { BenchmarkResult, BenchmarkSummary, summarizeBenchmark } from "../benchmark/runner.js";

export interface BenchmarkReport {
  generatedAt: string;
  summaries: BenchmarkSummary[];
  results: BenchmarkResult[];
}

export function createBenchmarkReport(results: BenchmarkResult[], split: BenchmarkSummary["split"] = "all"): BenchmarkReport {
  return { generatedAt: new Date().toISOString(), summaries: [summarizeBenchmark(results, split)], results };
}

export function reportMarkdown(report: BenchmarkReport): string {
  const summary = report.summaries[0];
  if (!summary) return "# Benchmark report\n\nNo results.\n";
  const rows = report.results.map((result) => `| ${result.caseId} | ${result.valid ? "yes" : "no"} | ${result.overall.toFixed(4)} | ${result.durationMs} | ${result.error ?? ""} |`).join("\n");
  return [
    "# Benchmark report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Model: **${summary.model}**`,
    `Cases: **${summary.cases}**, average score: **${summary.averageOverall}**, average latency: **${summary.averageLatencyMs} ms**`,
    "",
    "| Case | Valid | Overall | Latency (ms) | Error |",
    "|---|---:|---:|---:|---|",
    rows,
    "",
  ].join("\n");
}
