# DELTA Implementation Platform

DELTA turns enterprise implementation input into structured discovery, analysis, human decisions, and implementation-ready plans.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/delta-platform` — public DELTA narrative and operational MVP workspace
- `artifacts/api-server` — shared Express API routes
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/db/src/schema/delta-projects.ts` — Drizzle schema for the MVP project record and JSON workflow outputs
- `artifacts/delta-platform/src/App.tsx` — route tree and product UI
- `artifacts/delta-platform/src/index.css` — DELTA visual tokens and motion utilities

## Architecture decisions

- The MVP focuses on one vertical slice: Discover → Analyze → Approve → Plan.
- The public site and operations workspace share one React artifact so the narrative and product surface stay consistent.
- Workflow outputs are persisted in PostgreSQL as structured JSON attached to the implementation project; the schema leaves room for future normalized lifecycle tables.
- The first pass uses explicit local demo access rather than claiming an external identity provider is connected.
- Roadmap stages are shown as roadmap/preview states and are not presented as live autonomous capabilities.

## Product

The public experience explains DELTA as an AI implementation and delivery squad. The operational workspace supports a flagship consumer-electronics after-sales scenario with dashboard metrics, project creation, discovery and analysis runs, editable requirements, approval decisions, implementation planning, activity history, and traceability.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The generated API client needs `dom.iterable` in its TypeScript lib settings for `Headers.entries()`.
- Use the managed artifact workflows for the web app and API server; do not start them from the workspace root.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
