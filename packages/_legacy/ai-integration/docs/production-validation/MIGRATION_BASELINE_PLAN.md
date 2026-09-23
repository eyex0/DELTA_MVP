# DELTA Migration Baseline Plan

## Prohibited actions

Until this plan is approved and completed, do not:

- run `0000`, `0001`, or `0002` against the existing database as a clean DB
- create a fake `__drizzle_migrations` history
- reset or drop the database
- drop/rename live columns
- delete existing Supabase policies

## Options evaluated

### A. Baseline the existing production-like database

Safest for data preservation, but only after the live schema is authoritative,
all drift is classified, and an immutable baseline is reviewed. A baseline
must describe the database as it exists; it must not pretend 0000-0002 ran.

### B. Reconstruct migration history

Not currently safe. There is no live Drizzle journal and the schema differs
from 0001, so inserting historical records would be false evidence.

### C. Create a clean database and migrate forward

Safest for validating repository migrations and recommended for CI/disposable
development. It does not solve the existing database's data-preservation path.

### D. Generate reconciliation migrations

Required for the existing database after the drift report and identity/RLS
architecture are approved. Reconciliation must be additive or explicitly
backfilled, with rollback/backup procedures.

## Recommendation

Use **C** for migration correctness tests on a disposable clean database, and
use **A followed by D** for the existing Supabase database after schema
reconciliation. Do not call the existing database migrated through Drizzle.

## Required sequence

1. Establish the custom-JWT to transaction-local identity implementation.
2. Provision and verify a non-owner `delta_app` role.
3. Export live schema, policies, functions, triggers, and data counts.
4. Produce and approve the complete drift mapping.
5. Create a clean disposable database and run 0000-0002 there.
6. Test all policies with two organizations under `delta_app`.
7. Prepare additive reconciliation migrations for the existing database.
8. Back up and apply only reviewed migrations.
9. Re-run catalog, schema, RLS, and HTTP integration tests.
10. Record the final Drizzle state and command output.

## Current command evidence

`pnpm --filter @workspace/db migrate` was attempted without reset and failed
while applying migrations. Because the database has existing tables and no
Drizzle journal, this result is not evidence that any migration was applied.

## Status

**MIGRATIONS BLOCKED —**

The safe next step is architecture implementation plus a clean disposable
database validation, not a write to the existing Supabase database.
