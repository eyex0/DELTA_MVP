# Benchmark v2 and annotation workflow

`fixtures/benchmark-v2.json` contains 100 cases generated from reviewed
industry-specific process templates. It is a versioned manifest (`2.0.0`) with
the following immutable split allocation:

| Split | Cases | Purpose |
|---|---:|---|
| train | 60 | Prompt/schema development and adapter debugging |
| validation | 20 | Tuning decisions without touching the held-out test |
| test | 15 | Primary reported evaluation |
| challenge | 5 | Difficult held-out regression cases |

Each case contains source text, a canonical gold graph, expected relationships,
difficulty, domain, ambiguity notes, assumptions, and QC reviewer status.
The structural contract is documented in
`schemas/benchmark-manifest.schema.json`.

## Quality-control workflow

1. A curator creates or edits a case and records ambiguity and assumptions.
2. The gold graph is checked for node/edge references, reachability, decision
   branches, loop references, exception references, and BPMN conformance.
3. Expected relationships must match the gold transition set exactly.
4. A second reviewer changes `qualityStatus` to `reviewed` and records a stable
   reviewer identifier.
5. Run `npm run generate:benchmark` only when regenerating the reproducible
   template corpus.
6. Run `node dist/cli/index.js quality fixtures/benchmark-v2.json` before
   accepting a dataset version.
7. Keep `test` and `challenge` cases out of prompt tuning and adapter
   development.

The current corpus is a reliable structural/evaluation baseline, not a claim
that the generated language is equivalent to an expert-annotated enterprise
dataset. Human review should replace or augment template-generated text before
using the benchmark for model-selection decisions.

## Baseline

`fixtures/baseline-report-v2.json` and `fixtures/baseline-report-v2.md` are
measured outputs from the deterministic baseline adapter. They are not
performance claims about Microsoft Foundry or any other model.
