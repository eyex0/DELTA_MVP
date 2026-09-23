# Phase 2 implementation

Phase 2 extends the Phase 1 foundation without changing the canonical graph
contract.

## Provider adapter

`createFoundryAdapter` uses the Azure/Microsoft Foundry OpenAI-compatible chat
endpoint with JSON response mode. The adapter remains optional and is only
constructed when an endpoint, deployment, and API key are supplied. It
validates every response through the same graph validator and retries boundedly.

## Research operations

- Ontology normalization maps reviewed synonyms to canonical process verbs.
- `diffGraphs` reports added, removed, and changed graph entities.
- `proposeRepairs` creates explicit candidate graphs; it never mutates the
  caller's graph.
- Experiment records persist model, dataset, parameters, latency, metrics, and
  failures as JSON.
- Review annotations capture reviewer, status, comments, and corrected graphs.
- Benchmark reports provide reproducible aggregate score, validity, latency, and
  failure summaries in JSON or Markdown.

## Diagram targets

React Flow output now uses deterministic graph levels rather than input order.
Mermaid remains available, and BPMN XML output preserves canonical IDs and
transition labels.

## Known boundary

Ontology matching is deliberately controlled and deterministic. Embeddings,
human-reviewed challenge sets, BPMN schema conformance, and durable database
storage are Phase 3 concerns.
