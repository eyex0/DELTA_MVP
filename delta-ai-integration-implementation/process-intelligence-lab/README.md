# DELTA Process Intelligence Lab

Standalone research-ready foundation for converting business-process descriptions into
validated canonical graphs and editable diagrams.

## Architecture

```text
Input text
  -> ModelAdapter
  -> Canonical ProcessGraph
  -> ValidationEngine
  -> EvaluationEngine (against gold graphs)
  -> DiagramCompiler (editable graph output)
```

The core domain is provider-agnostic. Model adapters are ports; provider
implementations can be added without changing the graph, validator, evaluator,
or compiler.

## Run

```bash
npm install
npm test
npm run build
node dist/cli/index.js parse fixtures/inputs/warranty.txt
node dist/cli/index.js validate fixtures/gold/CASE-001.json
node dist/cli/index.js render fixtures/gold/CASE-001.json --format react-flow
node dist/cli/index.js evaluate fixtures/gold/CASE-001.json fixtures/gold/CASE-001.json
node dist/cli/index.js benchmark fixtures/benchmark.json
node dist/cli/index.js benchmark fixtures/benchmark-manifest.json --split test
node dist/cli/index.js report fixtures/benchmark.json --format markdown
node dist/cli/index.js quality fixtures/benchmark-v2.json
node dist/cli/index.js serve 8787
```

The CLI emits JSON so it can be used in CI pipelines and experiment runners.

Run commands from this directory. The package is standalone and does not import
the parent DELTA monorepo.

## Current capabilities

- Versioned canonical process schema with actors, nodes, transitions, rules,
  exceptions, loops, and parallel branches.
- Deterministic graph validation: identifiers, references, reachability,
  start/end topology, decision branches, actor references, and duplicate edges.
- Benchmark manifest and runner with deterministic metric computation.
- Model adapter interface plus deterministic local baseline adapter.
- Editable React Flow and Mermaid compilers preserving semantic IDs.
- BPMN XML export with deterministic level-based layout for editable React
  Flow output.
- CLI commands for parse, validate, render, evaluate, and benchmark.
- Phase 2 research tooling: Microsoft Foundry structured adapter, ontology-aware
  matching, repair proposals, graph diffs, experiment records, and review
  annotations.
- Unit and integration tests for all core layers.
- Adapter boundary with bounded retries and validation of structured model
  responses.
- Per-case benchmark latency and explicit adapter-failure reporting.
- Benchmark summaries and Markdown report generation for experiment review.
- Benchmark manifests with duplicate-ID, required-split, and split-selection
  validation.
- 100-case benchmark v2 corpus with industry, difficulty, ambiguity, gold graph,
  expected relationship, and QC annotation fields.
- Environment-selected providers (`DELTA_MODEL_PROVIDER=deterministic|foundry`)
  with required Foundry credentials validated before requests.
- Standalone HTTP API for health, parse, validate, and render operations.
- Immutable process version snapshots and semantic version comparisons.
- Separate BPMN conformance validation for executable/editable export targets.

## Remaining work

- Human-reviewed benchmark expansion and hidden challenge split.
- Embedding-backed semantic matching and controlled ontology governance.
- Production process repair, version diffing, experiment storage, and review
  workflows backed by durable storage.
- BPMN 2.0 conformance validation and layout optimization.

## Risks

- A deterministic baseline parser is intentionally not a production language
  model; model quality depends on the adapter selected.
- Structural metrics do not capture every semantic equivalence.
- Layout compilation currently preserves graph semantics but does not optimize
  crossing edges or lane placement.
