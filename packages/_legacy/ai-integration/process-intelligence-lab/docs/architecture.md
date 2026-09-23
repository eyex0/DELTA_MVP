# Technical architecture

DELTA Process Intelligence Lab is a standalone TypeScript/Node.js package. It
has no runtime dependency on the DELTA product repository.

## Boundaries

```text
Text / external model
        |
        v
ModelAdapter port -----> StructuredModelAdapter
        |
        v
Canonical ProcessGraph
        |
        +--> ValidationEngine
        +--> EvaluationEngine
        +--> Editable Diagram Compilers
        +--> Benchmark Runner
```

The canonical graph is the only interchange format between extraction,
validation, evaluation, and rendering. Renderers never infer or mutate business
logic.

## Runtime contracts

- `ModelAdapter` is the provider port. Provider SDKs belong in adapter packages,
  not in the domain.
- `StructuredModelAdapter` enforces JSON parsing, schema/graph validation, and
  bounded retries before returning a graph.
- `validateProcessGraph` is deterministic and produces machine-readable issue
  codes suitable for CI and regression tracking.
- `compareGraphs` performs identifier-independent semantic matching so model
  outputs can be compared with gold graphs that use different IDs.
- `runBenchmark` records per-case latency and adapter failures rather than
  silently dropping failed cases.

## Extension points

1. Add a provider adapter implementing `StructuredGenerationClient`.
2. Add schema migrations by introducing a new `SCHEMA_VERSION` and an explicit
   migration function.
3. Add evaluation metrics without changing the graph contract.
4. Add compiler targets that preserve node and transition IDs.
5. Add benchmark manifests with train, validation, test, and challenge splits.

The deterministic adapter is a reproducible reference adapter for tests and
pipeline verification; it is not intended to represent production model
quality.
