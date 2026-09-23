# Production hardening

The next implementation slice makes the research loop safer to operate:

- Model responses are decoded and checked for required graph fields before the
  graph validator runs.
- Provider selection is explicit. Deterministic mode is the default; Foundry
  mode requires endpoint, deployment, and API key environment variables.
- Benchmark manifests support train, validation, test, and challenge splits.
  Duplicate IDs and missing test/challenge coverage are rejected.
- CLI benchmark runs can select a manifest split without changing the source
  dataset.
- Benchmark reports remain deterministic artifacts containing score, validity,
  latency, and failure summaries.

The hidden challenge split should be maintained outside the public repository
before model tuning begins.
