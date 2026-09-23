# Contributing to DELTA

Keep changes inside the final `apps/`, `packages/`, `scripts/`, `tests/`, and `docs/` layout. Do not reintroduce snapshot project roots or commit generated runtime directories such as `node_modules`, `dist`, `build`, or `coverage`.

Before submitting a change, run `pnpm install`, `pnpm typecheck`, and `pnpm build`. Add or update focused tests when behavior changes. Database schema changes must include a reviewed migration and must preserve tenant isolation, indexes, and row-level security assumptions.

API changes should begin with the authoritative OpenAPI definition in `packages/api-spec`; regenerate generated clients rather than editing generated duplicates by hand. Never commit secrets or local `.env` files.
