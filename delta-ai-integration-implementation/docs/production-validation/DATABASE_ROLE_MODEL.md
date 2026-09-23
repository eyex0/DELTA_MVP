# DELTA PostgreSQL Role Model

## Observed state

The live audit connected successfully through the Supabase pooler and reported:

```text
current_user = postgres
```

The direct host configured in the repository could not be resolved from the
current environment. No production application role was independently verified.

The `postgres` owner role must not be used as evidence that RLS protects DELTA.
Owners and privileged service roles can bypass row security unless the database
is configured otherwise.

## Required roles

### `delta_app`

Non-owner role used by the API and worker for normal tenant operations.

- `LOGIN`
- access only to the DELTA database/schema and required sequences
- no database ownership
- no `BYPASSRLS`
- no membership in a role with `BYPASSRLS`
- no Supabase `service_role` credentials

### `delta_migrator`

Separate controlled role for schema migrations. It is not used by HTTP
requests or workers. Migration execution must be reviewed because the current
database has no Drizzle journal and has schema drift.

### Privileged maintenance role

If required, it is restricted to offline administration. It must not be placed
in frontend variables, browser code, or normal API runtime configuration.

## Required verification

Before any RLS claim:

```sql
select current_user;
select rolname, rolsuper, rolinherit, rolbypassrls
from pg_roles
where rolname in ('delta_app', 'delta_migrator');
```

The API and worker must be tested using `delta_app`, not `postgres`.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY` and database passwords remain server-only. They must
not be exposed through `VITE_*` variables or returned by an API endpoint.
Credentials previously exposed during setup should be rotated.

## Status

**BLOCKED FOR IMPLEMENTATION/VERIFICATION**

The current live role is `postgres`; the required non-owner application role
has not been provisioned or verified. No database role changes were made.
