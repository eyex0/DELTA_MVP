# DELTA repository map

This document defines the ownership boundaries for the monorepo. New code should
be added to the owning package instead of growing a cross-cutting file or adding
another top-level implementation folder.

## Runtime applications

| Path | Owns | Must not own |
| --- | --- | --- |
| `artifacts/api-server` | Express bootstrap, HTTP middleware, route composition, API handlers, workers | Database schemas, provider-specific prompts, React UI |
| `artifacts/delta-platform` | React/Vite application, route screens, UI components, browser API calls | SQL, provider credentials, server-side business rules |

## Shared libraries

| Path | Owns | Consumers |
| --- | --- | --- |
| `lib/process-schema` | Canonical process graph types, Zod validation, migrations, JSON Schema | API, AI, benchmark/lab |
| `lib/ai` | Model provider abstraction, prompts, extraction, agent runtime and tools | API and workers |
| `lib/db` | Drizzle schema, database access, tenant scoping and persistence helpers | API and workers |
| `lib/api-spec` | OpenAPI source contract | API and client generation |
| `lib/api-zod` | Generated request/response validators | API and tests |
| `lib/api-client-react` | Generated browser client/hooks | Frontend |

## Research application

`process-intelligence-lab` is a standalone research and benchmarking application.
It may consume a published version of `lib/process-schema`, but production API
behavior must not import lab internals.

## Rules for adding files

1. HTTP concerns go in `artifacts/api-server/src/routes`, `middlewares`, or
   `lib` only when they are reusable server infrastructure.
2. Provider and extraction concerns go in `lib/ai`; do not call a model from a
   route handler directly.
3. Database access goes through `lib/db`; routes must not create SQL clients.
4. Canonical graph changes start in `lib/process-schema`, then update adapters
   and tests in the same change.
5. Frontend feature screens belong in `artifacts/delta-platform/src/pages`;
   reusable visual primitives belong in `src/components`.
6. Marketing pages remain in `src/pages/marketing.tsx` and are not mixed with
   authenticated workspace screens.
7. Do not add another generated API shape by hand. Update OpenAPI and regenerate
   the dependent package.

## Current consolidation points

These files are intentionally retained for now because they are active
composition points and moving them without a test-first split would create
unnecessary risk:

- `artifacts/api-server/src/routes/delta.ts`: project workspace route family.
- `artifacts/delta-platform/src/App.tsx`: application router and legacy workspace
  composition.
- `artifacts/delta-platform/src/*.css`: existing visual layers.

They are the next refactoring targets after route and screen coverage has tests.
