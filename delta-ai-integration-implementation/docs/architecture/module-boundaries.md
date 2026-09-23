# Module boundaries and dependency direction

DELTA uses a one-way dependency direction:

```text
Frontend
  -> api-client-react / api-zod
  -> HTTP API
       -> AI
       -> DB
       -> process-schema

Research lab
  -> process-schema contract
  -> benchmark adapters and evaluators
```

## Allowed dependencies

- `artifacts/delta-platform` may depend on `api-client-react`, `api-zod`, and
  `process-schema` types needed for rendering.
- `artifacts/api-server` may depend on `ai`, `db`, `api-zod`, and
  `process-schema`.
- `lib/ai` may depend on `db` for persisted agent work and on
  `process-schema` for structured outputs.
- `lib/db` may depend on `process-schema` only for persistence types; it must not
  depend on the API or frontend.
- `lib/process-schema` is a leaf contract package and must not depend on the
  API, database, frontend, or lab.
- `process-intelligence-lab` must remain executable without the API server.

## Forbidden dependencies

- A route importing a frontend file.
- A React screen importing `lib/db`.
- A provider implementation importing Express request/response types.
- A database schema importing a route or AI prompt.
- The production API importing benchmark fixtures or lab-only classes.
- Handwritten response types that duplicate `lib/api-spec`.

## Refactoring sequence

When splitting a large file, use this order:

1. Add characterization tests around the existing behavior.
2. Extract a pure helper without changing the route or screen contract.
3. Move the helper into the owning module.
4. Replace the original implementation with the helper.
5. Run typecheck, targeted tests, and the relevant build.
6. Only then remove the old code.

This sequence keeps the organization work separate from behavioral changes.
