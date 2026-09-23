# DELTA Live Schema Drift Report

## Evidence source

The report is based on the live PostgreSQL catalog audit and repository
migrations. No DDL or data was changed.

## Migration source

The repository journal records:

- `0000_nice_kylun.sql`
- `0001_powerful_owl.sql`
- `0002_tenant_rls.sql`

The live database has no `__drizzle_migrations` table. It contains a broader
pre-existing public schema and Supabase internal migration tables.

## Confirmed differences

| Table/area | Live evidence | Repository expectation | Classification | Recommended action |
|---|---|---|---|---|
| `agent_versions` | `configuration`, `system_prompt`, `model_configuration` | `instructions`, `model`, `tool_configuration` in 0001 | incompatible/unknown | Map data and behavior first; do not rename/drop |
| `delta_projects` | additional `organization_id`, `workspace_id` | legacy repository shape differs | database-only/legacy | Confirm ownership and migrate application usage |
| Public table set | 39 additional public tables beyond the expected validator set | repository migration set is narrower | database-only/legacy | Inventory ownership and retain until classified |
| RLS policies | 43 live policies using `auth.jwt()` | 0002 uses `current_setting()` on fewer tables | incompatible identity model | Preserve/export; reconcile only after identity decision |
| Migration history | no Drizzle journal table | repository expects ordered Drizzle migrations | unknown | Use a controlled baseline or clean database |

## Required authoritative comparison

Before reconciliation, export for every public table:

- columns, PostgreSQL types, nullability, defaults
- primary keys and unique constraints
- indexes
- foreign keys and delete behavior
- triggers/functions
- RLS enabled/forced state
- policies, roles, `USING`, and `WITH CHECK`

Then compare against the Drizzle schema and classify every difference as:

`intentional legacy`, `missing repository migration`, `repository-only`,
`database-only`, `incompatible`, or `unknown`.

## Status

**SCHEMA DRIFT UNRESOLVED**

The current evidence is sufficient to block blind migration execution, but not
to justify destructive reconciliation.
