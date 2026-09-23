# Contributing to DELTA

## Prerequisites

- Node.js 22+
- pnpm 9
- PostgreSQL 16

## Getting started

```bash
git clone <repository-url>
cd delta-platform
pnpm install
cp .env.example .env       # fill in DATABASE_URL
pnpm --filter @workspace/db run push
```

## Development loop

- `pnpm dev:api` — run the API server (http://localhost:3100).
- `pnpm dev:web` — run the web dev server with live reload.
- `pnpm typecheck` — typecheck all packages and apps.
- `pnpm build` — typecheck and build everything.

## Guidelines

- The API contract lives in `packages/api-spec/openapi.yaml`. After changing
  it, regenerate the clients with
  `pnpm --filter @workspace/api-spec run codegen` and commit the result.
- Do not edit generated code (`packages/api-zod/src/generated`,
  `packages/api-client/src/generated`).
- Database changes go through `packages/database` (Drizzle). Add migrations or
  schema updates there and sync with `pnpm --filter @workspace/db run push`.
- Keep business logic out of UI components and database access inside
  `packages/database`.
- Code under `packages/_legacy/` is reference material from earlier project
  phases; it is not part of the workspace. Do not build on it — extract and
  modernize the parts you need into proper packages first.
- Never commit secrets, `.env` files, build output, or `node_modules`.

## Pull requests

1. Branch from `main`.
2. Keep the change focused; one logical change per PR.
3. Verify `pnpm typecheck` and `pnpm build` pass.
4. Fill in the pull request template (`.github/PULL_REQUEST_TEMPLATE.md`).
5. Request at least one review.

## Reporting bugs

Use the bug report issue template and include reproduction steps, expected
behavior, and actual behavior.
