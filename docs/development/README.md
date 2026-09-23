# DELTA Development

## Project Structure

- pps/ — executable applications
- packages/ — reusable platform modules
- docs/ — architecture and product documentation
- 	ests/ — automated tests
- scripts/ — development scripts
- ixtures/ — test and benchmark data

## Development Principles

1. Keep business logic out of UI components.
2. Keep database access isolated.
3. Reuse shared types through packages/shared.
4. AI provider integrations belong in packages/ai.
5. RAG logic belongs in packages/knowledge.
6. Workflow execution belongs in packages/workflows.
7. Never commit secrets.
8. Every major feature requires tests.
9. Prefer small modules over large files.
10. Keep production code separate from experiments.

## Local Development

Create:

.env

from:

.env.example

Then install dependencies and start the required applications.

## Testing

Run unit tests before committing.

Run integration tests before merging.

Benchmark changes must be evaluated against the benchmark fixtures.
