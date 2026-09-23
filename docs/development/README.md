# Development

## Project structure

- `apps/` — executable applications (`web`, `api`)
- `packages/` — reusable platform modules
- `packages/_legacy/` — reference code from earlier project phases (not part of the workspace)
- `tests/` — automated tests (unit / integration / e2e)
- `fixtures/` — test and benchmark data
- `docs/` — architecture, development, API, and product documentation
- `scripts/` — development scripts
- `.github/` — CI workflows and templates

## Setup

Requirements: Node.js 22+, pnpm 9, PostgreSQL 16.

```bash
pnpm install
cp .env.example .env       # fill in DATABASE_URL
pnpm --filter @workspace/db run push
```

## Daily commands

| Command                    | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `pnpm dev:api`             | Run the API server (port from `PORT`)     |
| `pnpm dev:web`             | Run the web dev server with live reload   |
| `pnpm typecheck`           | Typecheck packages and apps               |
| `pnpm build`               | Typecheck and build all workspaces        |
| `pnpm --filter @workspace/db run push` | Sync the database schema   |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API clients |

## Development principles

1. Keep business logic out of UI components.
2. Keep database access inside `packages/database`.
3. API types come from the OpenAPI spec; regenerate instead of editing
   generated code.
4. Reuse shared dependency versions through the pnpm `catalog:`.
5. Never commit secrets.
6. Every major feature requires tests (added under `tests/`).
7. Prefer small, focused modules.
8. Keep production code separate from experiments (use `packages/_legacy/`
   for unmigrated prototypes, not the workspace).

## Testing

Run unit tests before committing and integration tests before merging.
Benchmark changes must be evaluated against the data in `fixtures/`.

## Post-merge hook

`scripts/post-merge.sh` reinstalls dependencies and syncs the database
schema; wire it up in your local git hooks if you want that behavior.
