# Evaluation methodology

The benchmark compares a candidate graph with a human-reviewed gold graph. It
does not compare rendered images.

## Metrics

- Node precision and recall: activity/decision nodes are matched by type and
  normalized token similarity.
- Transition precision and recall: matched node pairs and transition type must
  agree.
- Decision accuracy: candidate decision count is compared with the gold graph.
- Actor assignment accuracy: matched nodes must resolve to actors with the same
  normalized name.
- Completeness: mean node and transition recall.
- Hallucination rate: one minus node precision.
- Structural validity: one only when the validation engine reports no errors.
- Overall: a bounded weighted composite for ranking adapters, not a substitute
  for human review.

Metrics are intentionally deterministic. Semantic equivalence that cannot be
captured by normalized labels must be added through an explicit ontology or a
reviewed matching strategy in Phase 2.

## Benchmark discipline

Every case should include a stable ID, domain, difficulty, source text, and
gold graph. Keep the hidden challenge split out of prompt/model iteration.
Persist adapter ID, schema version, duration, failures, and metric output for
reproducibility.
