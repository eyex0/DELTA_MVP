import test from "node:test";
import assert from "node:assert/strict";
import { decodeProcessGraph, DeterministicBaselineAdapter } from "../adapters/model.js";
import { compileMermaid, compileReactFlow } from "../compiler/editable.js";
import { compareGraphs } from "../evaluation/metrics.js";
import { validateProcessGraph } from "../validation/validator.js";
import { StructuredModelAdapter } from "../adapters/model.js";
import { compileBpmn } from "../compiler/editable.js";
import { diffGraphs, proposeRepairs } from "../research/repair.js";
import { normalizeWithOntology } from "../research/ontology.js";
import { createBenchmarkReport, reportMarkdown } from "../research/report.js";
import { summarizeBenchmark } from "../benchmark/runner.js";
import { createAdapterFromEnvironment } from "../adapters/factory.js";
import { validateBenchmarkManifest } from "../benchmark/runner.js";
import { createProcessVersion, compareVersions } from "../research/versioning.js";
import { validateBpmnConformance } from "../validation/bpmn.js";
import { buildBenchmarkManifest } from "../benchmark/generator.js";
import { validateBenchmarkQuality } from "../benchmark/runner.js";
import { runModelBattle, summarizeModelBattle } from "../benchmark/model-battle.js";

test("baseline adapter creates a valid graph", async () => {
  const graph = (await new DeterministicBaselineAdapter().generate({ input: "Receive request. Validate request. Complete request.", schemaVersion: "1.0" })).graph;
  const result = validateProcessGraph(graph);
  assert.equal(result.valid, true);
  assert.equal(graph.nodes.length, 5);
});

test("validator catches unreachable nodes", async () => {
  const graph = (await new DeterministicBaselineAdapter().generate({ input: "Receive request.", schemaVersion: "1.0" })).graph;
  graph.nodes.push({ id: "N-ORPHAN", type: "activity", name: "Orphan", inputs: [], outputs: [], conditions: [] });
  const result = validateProcessGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.code === "UNREACHABLE_NODE"));
});

test("compilers preserve semantic identifiers", async () => {
  const graph = (await new DeterministicBaselineAdapter().generate({ input: "Receive request. Complete request.", schemaVersion: "1.0" })).graph;
  const reactFlow = compileReactFlow(graph);
  const mermaid = compileMermaid(graph);
  assert.equal(reactFlow.nodes[0]?.id, "N-START");
  assert.match(mermaid.source ?? "", /N_START/);
});

test("evaluation is deterministic and bounded", async () => {
  const adapter = new DeterministicBaselineAdapter();
  const graph = (await adapter.generate({ input: "Receive request.", schemaVersion: "1.0" })).graph;
  const metrics = compareGraphs(graph, graph, true);
  assert.equal(metrics.overall, 1);
  for (const value of Object.values(metrics)) assert.ok(typeof value !== "number" || (value >= 0 && value <= 1));
});

test("evaluation matches semantically equivalent graphs with different identifiers", async () => {
  const adapter = new DeterministicBaselineAdapter();
  const candidate = (await adapter.generate({ input: "Receive request. Complete request.", schemaVersion: "1.0" })).graph;
  const gold = structuredClone(candidate);
  gold.processId = "GOLD-001";
  gold.nodes = gold.nodes.map((node) => ({ ...node, id: `G-${node.id}` }));
  gold.transitions = gold.transitions.map((edge) => ({ ...edge, id: `G-${edge.id}`, from: `G-${edge.from}`, to: `G-${edge.to}` }));
  const metrics = compareGraphs(candidate, gold, true);
  assert.equal(metrics.nodeRecall, 1);
  assert.equal(metrics.transitionRecall, 1);
});

test("structured adapter rejects invalid model output", async () => {
  const adapter = new StructuredModelAdapter("test-adapter", {
    async generate() {
      return { text: JSON.stringify({ invalid: true }) };
    },
  });

  test("model battle captures measured and unavailable validation cases", async () => {
    const adapter = new DeterministicBaselineAdapter();
    const graph = (await adapter.generate({ input: "Receive request.", schemaVersion: "1.0" })).graph;
    const report = await runModelBattle([
      {
        id: "measured", name: "Measured", version: "1", provider: "local", modelClass: "local",
        generation: { temperature: 0, maxAttempts: 1, promptVersion: "p1", schemaVersion: "1.0" }, adapter,
      },
      {
        id: "unavailable", name: "Unavailable", version: "1", provider: "remote", modelClass: "cloud_llm",
        generation: { temperature: 0, maxAttempts: 1, promptVersion: "p1", schemaVersion: "1.0" },
        unavailableReason: "credentials are not configured",
      },
    ], [{
      id: "CASE-BATTLE", domain: "test", difficulty: "simple", input: "Receive request.", gold: graph,
      expectedRelationships: [], annotations: { ambiguity: [], assumptions: [], qualityStatus: "reviewed", reviewer: "test" },
    }], "2.0.0", "validation");
    assert.equal(report.results.length, 2);
    assert.equal(report.results[0]?.status, "measured");
    assert.equal(report.results[1]?.error?.category, "provider_unavailable");
    assert.equal(summarizeModelBattle(report)[0]?.measuredCases, 1);
  });

  test("Phase 2 research tools preserve graph semantics", async () => {
    const adapter = new DeterministicBaselineAdapter();
    const graph = (await adapter.generate({ input: "Receive request. Complete request.", schemaVersion: "1.0" })).graph;
    const changed = structuredClone(graph);
    changed.nodes[1]!.name = "Accept request";
    assert.equal(normalizeWithOntology(changed.nodes[1]!.name), "receive request");
    assert.ok(diffGraphs(graph, changed).some((change) => change.kind === "changed"));
    assert.match(compileBpmn(graph).source ?? "", /bpmn:definitions/);
    const broken = structuredClone(graph);
    broken.nodes = broken.nodes.filter((node) => node.type !== "end");
    assert.ok(proposeRepairs(broken).length > 0);
  });

  test("benchmark summaries and reports expose failures and latency", async () => {
    const adapter = new DeterministicBaselineAdapter();
    const graph = (await adapter.generate({ input: "Receive request.", schemaVersion: "1.0" })).graph;
    const results = await (await import("../benchmark/runner.js")).runBenchmark(adapter, [{
      id: "CASE-REPORT",
      domain: "test",
      difficulty: "simple",
      input: "Receive request.",
      gold: graph,
      expectedRelationships: graph.transitions.map((transition) => ({ from: transition.from, to: transition.to, type: transition.type })),
      annotations: { ambiguity: [], assumptions: [], qualityStatus: "reviewed", reviewer: "test" },
    }]);
    const summary = summarizeBenchmark(results);
    assert.equal(summary.cases, 1);
    assert.equal(summary.failureRate, 0);
    assert.match(reportMarkdown(createBenchmarkReport(results)), /Benchmark report/);
  });

  test("runtime decoding and provider configuration reject unsafe inputs", () => {
    assert.throws(() => decodeProcessGraph({}), /Process graph field actors/);
    assert.equal(createAdapterFromEnvironment({ DELTA_MODEL_PROVIDER: "deterministic" }).id, "deterministic-baseline-v1");
    assert.throws(() => createAdapterFromEnvironment({ DELTA_MODEL_PROVIDER: "foundry" }), /FOUNDRY_ENDPOINT/);
    const manifest = { version: "1", cases: [] as never[] };
    assert.ok(validateBenchmarkManifest(manifest).some((message) => message.includes("test split")));
  });

  test("versioning and BPMN conformance are deterministic", async () => {
    const graph = (await new DeterministicBaselineAdapter().generate({ input: "Receive request.", schemaVersion: "1.0" })).graph;
    const from = createProcessVersion(graph, "1.0.0", "test");
    const changed = structuredClone(graph);
    changed.nodes[1]!.name = "Validate request";
    const to = createProcessVersion(changed, "1.1.0", "test");
    assert.equal(compareVersions(from, to).changes.length, 1);
    assert.equal(validateBpmnConformance(graph).valid, true);
  });

  test("benchmark generator produces the governed 100-case corpus", () => {
    const manifest = buildBenchmarkManifest();
    assert.equal(manifest.version, "2.0.0");
    assert.equal(manifest.cases.length, 100);
    assert.equal(validateBenchmarkQuality(manifest).length, 0);
  });
  let error: unknown;
  try {
    await adapter.generate({ input: "x", schemaVersion: "1.0" });
  } catch (caught) {
    error = caught;
  }
  assert.match(error instanceof Error ? error.message : "", /failed after 2 attempts/);
});
