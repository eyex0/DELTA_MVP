import { readFile, writeFile } from "node:fs/promises";
import { DeterministicBaselineAdapter } from "../adapters/model.js";
import { runBenchmark, BenchmarkCase, BenchmarkManifest, summarizeBenchmark, selectBenchmarkSplit, validateBenchmarkManifest, validateBenchmarkQuality } from "../benchmark/runner.js";
import { compileBpmn, compileMermaid, compileReactFlow } from "../compiler/editable.js";
import { ProcessGraph } from "../domain/process.js";
import { compareGraphs } from "../evaluation/metrics.js";
import { validateProcessGraph } from "../validation/validator.js";
import { diffGraphs, proposeRepairs } from "../research/repair.js";
import { createBenchmarkReport, reportMarkdown } from "../research/report.js";
import { createAdapterFromEnvironment } from "../adapters/factory.js";
import { createApiServer } from "../api/server.js";
import { configuredModelProfiles } from "../benchmark/model-profiles.js";
import { modelBattleMarkdown, runModelBattle, summarizeModelBattle } from "../benchmark/model-battle.js";

async function load(path: string): Promise<ProcessGraph> {
  return JSON.parse(await readFile(path, "utf8")) as ProcessGraph;
}

function usage(): never {
  console.error("Usage: delta-process <parse|validate|render|evaluate|benchmark|battle|report|quality|diff|repair> ...");
  process.exit(1);
}

const [command, first, second] = process.argv.slice(2);
if (!command) usage();
if (command === "parse") {
  const input = await readFile(first ?? usage(), "utf8");
  const response = await createAdapterFromEnvironment(process.env).generate({ input, schemaVersion: "1.0" });
  console.log(JSON.stringify(response.graph, null, 2));
} else if (command === "validate") {
  console.log(JSON.stringify(validateProcessGraph(await load(first ?? usage())), null, 2));
} else if (command === "render") {
  const graph = await load(first ?? usage());
  const format = second === "--format" ? process.argv[5] : "react-flow";
  console.log(JSON.stringify(format === "mermaid" ? compileMermaid(graph) : format === "bpmn" ? compileBpmn(graph) : compileReactFlow(graph), null, 2));
} else if (command === "evaluate") {
  const candidate = await load(first ?? usage());
  const gold = await load(second ?? usage());
  console.log(JSON.stringify(compareGraphs(candidate, gold, validateProcessGraph(candidate).valid), null, 2));
} else if (command === "benchmark") {
  const loaded = JSON.parse(await readFile(first ?? usage(), "utf8")) as BenchmarkCase[] | BenchmarkManifest;
  const cases = Array.isArray(loaded) ? loaded : loaded.cases;
  if (!Array.isArray(loaded) && validateBenchmarkManifest(loaded).length) throw new Error(validateBenchmarkManifest(loaded).join("; "));
  const split = process.argv.includes("--split") ? process.argv[process.argv.indexOf("--split") + 1] as BenchmarkManifest["cases"][number]["split"] : undefined;
  const selected = !Array.isArray(loaded) && split ? selectBenchmarkSplit(loaded, split) : cases;
  const results = await runBenchmark(createAdapterFromEnvironment(process.env), selected);
  const summary = summarizeBenchmark(results, split ?? "all");
  console.log(JSON.stringify({
    model: "deterministic-baseline-v1",
    cases: results.length,
    results,
    summary,
  }, null, 2));
} else if (command === "diff") {
  console.log(JSON.stringify(diffGraphs(await load(first ?? usage()), await load(second ?? usage())), null, 2));
} else if (command === "repair") {
  const graph = await load(first ?? usage());
  console.log(JSON.stringify({ validation: validateProcessGraph(graph), proposals: proposeRepairs(graph) }, null, 2));
} else if (command === "report") {
  const loaded = JSON.parse(await readFile(first ?? usage(), "utf8")) as BenchmarkCase[] | BenchmarkManifest;
  const cases = Array.isArray(loaded) ? loaded : loaded.cases;
  const results = await runBenchmark(createAdapterFromEnvironment(process.env), cases);
  const report = createBenchmarkReport(results);
  const format = second === "--format" ? process.argv[5] : "json";
  console.log(format === "markdown" ? reportMarkdown(report) : JSON.stringify(report, null, 2));
} else if (command === "battle") {
  const manifest = JSON.parse(await readFile(first ?? usage(), "utf8")) as BenchmarkManifest;
  const split = (process.argv[process.argv.indexOf("--split") + 1] ?? "validation") as BenchmarkManifest["cases"][number]["split"];
  if (split !== "validation") throw new Error("Model battle is restricted to the validation split in Phase 3");
  const cases = selectBenchmarkSplit(manifest, split);
  const battle = await runModelBattle(configuredModelProfiles(process.env), cases, manifest.version, split);
  const outputBase = process.argv[process.argv.indexOf("--out") + 1] ?? "fixtures/model-battle-validation";
  await writeFile(`${outputBase}.json`, JSON.stringify({ ...battle, summaries: summarizeModelBattle(battle) }, null, 2), "utf8");
  await writeFile(`${outputBase}.md`, modelBattleMarkdown(battle), "utf8");
  console.log(JSON.stringify({ experimentId: battle.experimentId, split, cases: cases.length, summaries: summarizeModelBattle(battle), output: [`${outputBase}.json`, `${outputBase}.md`] }, null, 2));
} else if (command === "quality") {
  const manifest = JSON.parse(await readFile(first ?? usage(), "utf8")) as BenchmarkManifest;
  const errors = validateBenchmarkQuality(manifest);
  console.log(JSON.stringify({ valid: errors.length === 0, errors }, null, 2));
} else if (command === "serve") {
  const port = Number(process.argv[3] ?? "8787");
  createApiServer().listen(port, () => console.error(`DELTA process API listening on ${port}`));
} else {
  usage();
}
