# DELTA Authentication-to-PostgreSQL Identity Decision

## Decision

DELTA will use one authoritative identity model:

```text
Custom application JWT
  -> Express requireAuth
  -> server-side user and organization membership lookup
  -> request-scoped PostgreSQL transaction
  -> SET LOCAL app.organization_id = '<verified organization UUID>'
  -> PostgreSQL RLS
```

The live Supabase `auth.jwt()` model is not authoritative for DELTA. DELTA does
not currently authenticate requests through Supabase Auth, and the repository
does not currently set `app.organization_id`. The existing `0002_tenant_rls`
model is therefore a target design, not a verified implementation.

## Authentication and membership

1. `requireAuth` verifies the custom JWT using `JWT_SECRET`.
2. The middleware loads the user by the JWT `userId`.
3. The organization ID is taken from the server-side user/membership record.
4. Request body, query-string, path, and client metadata never select the
   tenant. A requested project/workspace is independently checked against the
   authenticated organization and membership.
5. The request transaction sets the verified organization ID with `SET LOCAL`.

## PostgreSQL identity

Application SQL must execute through a non-owner application role. The current
audit used `current_user = postgres`; that is not evidence of RLS enforcement
because an owner/service role can bypass RLS. The API role must be explicitly
provisioned and documented before RLS validation.

The API must not use a Supabase `service_role` key for normal tenant queries.
If a privileged maintenance operation is required, it must be isolated from
request handling and never exposed to the browser.

## Transaction and pooling rules

- Every protected operation uses a checked-out pooled connection.
- The operation begins a transaction.
- It executes `select set_config('app.organization_id', $1, true)`.
- All tenant queries and writes run before commit/rollback.
- `SET LOCAL` automatically clears the setting at transaction end.
- No session-level `SET` is allowed.
- Streaming/SSE handlers must not hold a tenant transaction open for the
  lifetime of a stream; they must materialize authorized event reads or use a
  dedicated short transaction per read.
- Nested operations must reuse the outer transaction rather than checking out
  a second connection.

## Workers and approvals

Workers do not trust an organization ID from an arbitrary payload. They:

1. claim the job,
2. load the job and related run from the database,
3. verify ownership and organization consistency,
4. establish a transaction-local tenant context,
5. execute and persist results in that transaction.

Approval resume follows the same sequence. The approval row and run determine
the tenant; the caller cannot change it.

## Compatibility assessment

The design is compatible with Express, Drizzle, and `pg`, but the current
implementation is not yet compatible with this requirement because `lib/db`
creates one global Drizzle instance and the auth middleware performs queries
without establishing a request transaction. This is an implementation blocker,
not a reason to choose a second identity model.

## Implementation status

The canonical `withTenantTransaction` helper now:

- rechecks organization membership inside the transaction,
- uses `SET LOCAL app.organization_id`,
- commits on success and rolls back on failure.

`requireAuth` invokes the helper for membership verification. The worker and
all tenant queries are not yet migrated to execute through the same transaction
object, so this is not yet proof that every protected operation is RLS-backed.

The non-owner role, RLS policy reconciliation, and real two-tenant HTTP/RLS
tests remain required.

## Current status

**IMPLEMENTATION IN PROGRESS — RLS VERIFICATION BLOCKED**
