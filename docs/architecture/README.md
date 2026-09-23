# Architecture

DELTA is a multi-tenant platform for knowledge management, agent execution,
and workflow automation.

## Current structure

```
apps/web  ──HTTP /api──▶  apps/api  ──SQL──▶  PostgreSQL (packages/database)
```

- **apps/web** — Vite + React 19 dashboard. Consumes the API through the
  generated React Query client (`packages/api-client`). In development the
  Vite dev server proxies `/api` to the API server (single origin).
- **apps/api** — Express 5 server. Routes are grouped under `/api`; request
  and response payloads are validated with the generated Zod schemas
  (`packages/api-zod`). Bundled with esbuild into a single ESM file.
- **packages/database** — Drizzle ORM schema and PostgreSQL connection pool.
  All database access goes through this package.
- **packages/api-spec** — the OpenAPI 3.1 specification. This is the source
  of truth for the API contract; `packages/api-zod` and
  `packages/api-client` are generated from it with orval.

## Core principles

- The API contract is the source of truth; clients and validators are
  generated, never hand-written.
- Database access is isolated in one package.
- Business logic stays out of UI components.
- The AI runtime will be provider-independent (see `packages/_legacy/` for
  earlier prototype implementations).
- Multi-tenancy, server-side authorization, and database-level isolation are
  platform-level requirements for the consolidated product.

## Target domains

The product roadmap covers three domains that will be built as first-class
packages:

- **Knowledge / RAG** — document ingestion, embeddings, retrieval.
- **AI agents** — provider-independent agent execution (e.g. NVIDIA, Foundry,
  OpenAI-compatible endpoints).
- **Workflows** — versioned, auditable workflow automation.

Prototype implementations from earlier project phases live in
`packages/_legacy/` and will be consolidated into proper packages when work
on each domain starts.
