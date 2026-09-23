# DELTA Platform

DELTA is an implementation platform that combines knowledge management, agent
execution, and workflow automation. This repository contains the web
application, the HTTP API, the database package, and the supporting tooling of
the platform.

## What DELTA is

The platform is organized around a delivery workflow: users create projects,
capture requirements, run discovery and analysis steps, review approvals, and
generate implementation plans with full traceability back to requirements.
The long-term product direction includes a provider-independent AI runtime
for agent execution, a knowledge base with retrieval, and versioned workflow
automation. The packages under `packages/_legacy/` hold earlier prototype
implementations of those areas, kept as reference for the upcoming
consolidation work.

## Repository architecture

```
apps/
  web/            Vite + React 19 frontend (dashboard)
  api/            Express 5 HTTP API
packages/
  database/       Drizzle ORM schema and PostgreSQL access
  api-spec/       OpenAPI specification (source of truth for the API)
  api-zod/        Generated Zod schemas (from the OpenAPI spec)
  api-client/     Generated React Query client (from the OpenAPI spec)
  _legacy/        Reference code from earlier project phases (not part of the workspace)
tests/            Test suites (unit / integration / e2e)
fixtures/         Test and benchmark data
docs/             Architecture, development, API, and product documentation
scripts/          Development scripts
.github/          CI workflows, issue templates, pull request template
```

Key conventions:

- The API contract is defined in `packages/api-spec/openapi.yaml`. Clients and
  validation schemas are generated from it — do not edit generated code by
  hand; run `pnpm --filter @workspace/api-spec run codegen`.
- The API server is bundled with esbuild (`apps/api/build.mjs`) and served as a
  single ESM bundle.
- The frontend talks to the API through the `/api` path; in development the
  Vite dev server proxies `/api` to the API server (single origin).

## Local development

Requirements:

- Node.js 22+
- pnpm 9 (`corepack enable` or `npm install -g pnpm@9`)
- PostgreSQL 16 (running locally or via Docker:
  `docker run -d --name delta-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine`)

Setup:

```bash
cp .env.example .env          # fill in DATABASE_URL
pnpm install                  # requires pnpm; see package.json preinstall
pnpm --filter @workspace/db run push   # create/sync the database schema
```

Run the applications (in separate terminals or in the background):

```bash
pnpm dev:api                  # API on http://localhost:3100
pnpm dev:web                  # web app on http://localhost:4173 (proxies /api)
```

## Environment variables

| Variable         | Used by | Description                                    |
| ---------------- | ------- | ---------------------------------------------- |
| `NODE_ENV`       | api     | `development` or `production`                 |
| `PORT`           | api     | API listen port (default required, e.g. 3100)  |
| `LOG_LEVEL`      | api     | pino log level (default `info`)                |
| `DATABASE_URL`   | api, db | PostgreSQL connection string                   |
| `API_PROXY_URL`  | web     | API target for the dev-server proxy            |
| `BASE_PATH`      | web     | Base path the web app is served from           |

See `.env.example` for the template. Never commit real secrets.

## Running the application

- `pnpm dev:api` — build and start the API server (Express 5, port from `PORT`).
- `pnpm dev:web` — start the Vite dev server with live reload.
- `pnpm --filter @workspace/api-server run start` — run the last built API bundle.

## Testing

There are currently no root-level test suites; the `tests/` directory is the
designated home for unit, integration, and e2e tests as they are introduced.
Legacy prototype code under `packages/_legacy/` includes tests that are not
part of the workspace and are not executed.

## Building

```bash
pnpm build        # typecheck, then build every workspace package
```

The web build is emitted to `apps/web/dist/public`; the API bundle to
`apps/api/dist/index.mjs`.

## Repository conventions

- pnpm workspaces; package names use the `@workspace/*` scope.
- Dependency versions shared across packages are managed through the
  `catalog:` protocol in `pnpm-workspace.yaml`.
- `minimumReleaseAge: 1440` in `pnpm-workspace.yaml` requires npm packages to
  be at least one day old before installation (supply-chain defense).
- TypeScript project references: `pnpm typecheck` builds the package graph
  with `tsc --build` and then typechecks the apps.
- Business logic stays out of UI components; database access goes through
  `packages/database`; API types come from the OpenAPI spec.

## Contribution workflow

1. Open an issue (bug report or feature request) and discuss the approach.
2. Create a branch from `main`.
3. Make the change, keep commits focused, and follow the templates in
   `.github/`.
4. Ensure `pnpm typecheck` and `pnpm build` pass locally.
5. Open a pull request and request review.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.
