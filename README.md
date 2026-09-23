# DELTA MVP

DELTA is a multi-tenant implementation operations platform combining project intelligence, knowledge retrieval, AI agents, and durable workflows.

## Monorepo layout

- `apps/api` — the Express API, authentication, tenant-scoped routes, agent execution integration, workflows, and process intelligence.
- `apps/web` — the authentication-aware React/Vite frontend.
- `apps/worker` — the background agent execution worker.
- `packages/ai` — model providers, gateway, agent loop, tools, approvals, and AI runtime types.
- `packages/core` — process-intelligence schema and shared platform contracts.
- `packages/database` — Drizzle client, tenant context, authoritative schema, migrations, queue, and database utilities.
- `packages/knowledge` — document ingestion, chunking, embeddings, retrieval, memory, and context assembly.
- `packages/workflows` — workflow persistence helpers, execution state, leasing, and claiming.
- `packages/shared`, `packages/api-spec`, and `packages/api-zod` — generated API client/specification/schema packages.
- `scripts` — local validation and operational scripts.

## Development

Use pnpm. Copy `.env.example` to `.env`, provide a PostgreSQL `DATABASE_URL` for normal development, or set `DATABASE_URL=DISABLE_DB` for preview-only in-memory operation.

```sh
pnpm install
pnpm typecheck
pnpm build
pnpm --filter @workspace/api run dev
pnpm --filter @workspace/web run dev -- --port 5173
pnpm --filter @workspace/worker run dev
```

Database migrations are not run automatically. Review migration files and environment configuration before applying any database change.
