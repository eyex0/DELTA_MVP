# Legacy reference code

This directory preserves functional code from earlier project phases that
cannot yet be merged into the workspace packages without reconciliation.
It is **reference material only**:

- It is NOT part of the pnpm workspace and is not installed, built,
  typechecked, or tested.
- Files that were byte-identical to the current workspace code were dropped;
  only divergent or unique files are kept.
- Development artifacts (embedded repositories, design mockups, Replit
  configuration, duplicated frontend shells) were removed.

## Contents

| Directory          | Origin                                                            | Notable content                                                                    |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ai-integration/`  | AI integration phase                                              | `lib/ai` (NVIDIA / Foundry / OpenAI-compatible providers, agent runtime, tiered gateway), auth + multi-tenant RLS (Entra, tenant scoping, queue/worker), `process-intelligence-lab`, `lib/process-schema`, production validation docs, drizzle SQL migrations |
| `knowledge-rag/`  | Knowledge/RAG phase                                               | Knowledge schema + queries (pgvector, RLS), Supabase SQL migrations, knowledge API routes, `lib/ai` variant, `docs/database-architecture.md` |
| `workflows/`      | Workflows phase                                                   | Workflow schema + queries, workflow API routes, updated OpenAPI spec                |

## Why this exists

The three snapshots implement overlapping parts of the platform (database
schemas, API routes, frontend) with **incompatible, divergent designs**.
Merging them requires deliberate reconciliation per domain; until that
happens, the code is kept here so no functional work is lost.

## Rules

1. Do not import from `packages/_legacy/**` in workspace code.
2. When consolidating a domain (AI runtime, knowledge, workflows), extract
  the relevant pieces into a proper package, modernize them, and delete the
  corresponding legacy directory.
3. This directory should shrink over time and eventually disappear.
