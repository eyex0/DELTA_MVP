import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BenchmarkResult } from "../benchmark/runner.js";

export interface ExperimentRecord { id: string; date: string; model: string; schemaVersion: string; dataset: string; parameters: Record<string, string | number | boolean>; results: BenchmarkResult[]; }
export async function saveExperiment(path: string, record: ExperimentRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(record, null, 2), "utf8");
}
export async function loadExperiment(path: string): Promise<ExperimentRecord> {
  return JSON.parse(await readFile(path, "utf8")) as ExperimentRecord;
}
