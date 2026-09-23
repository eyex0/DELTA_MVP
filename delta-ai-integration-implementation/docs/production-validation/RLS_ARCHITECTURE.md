# DELTA RLS Architecture

## Authoritative evaluation function

All tenant policies will evaluate the transaction-local setting:

```sql
current_setting('app.organization_id', true)::uuid
```

The value is written only by trusted server code after JWT verification and
membership lookup. Client-supplied organization IDs are never used to set it.

Policies must be explicit for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
Updates require both `USING` and `WITH CHECK`. Child tables must resolve tenant
ownership through their parent when they do not store `organization_id`
directly.

## Table classification

| Class | Tables |
|---|---|
| Tenant-owned | organizations, users, organization_members, workspaces, workspace_members, projects, tasks, agents, agent_runs, approvals, execution_jobs, workflows, workflow_runs, knowledge_documents, knowledge_memories, usage_events, api_keys, integrations, integration_connections, integration_credentials, webhooks, audit_logs, model_requests, conversations |
| Tenant child | agent_versions, agent_steps, agent_messages, knowledge_sources, knowledge_chunks, knowledge_embeddings, conversation_messages, workflow_versions, workflow_steps, workflow_step_runs, agent_tools, comments, attachments, execution_events, execution_logs |
| Globally shared/system | plans, system_settings, feature flags without organization ownership, globally shared tools where explicitly designated |
| Legacy/unknown | delta_projects and any table whose ownership cannot be derived from the current schema |

This classification must be reconciled with the authoritative live schema
before policy DDL is changed.

## Live evidence

The live database currently has `relrowsecurity = true` on public tables, but
`relforcerowsecurity = false` throughout the audit. It has 43 public policies.
Many policies use:

```sql
auth.jwt() ->> 'organization_id'
```

That is a Supabase Auth identity mechanism and is not connected to DELTA's
custom JWT middleware.

Several tables have RLS enabled with no policies, including `users`,
`organizations`, `agent_versions`, `conversations`, `workflow_versions`,
`workflow_steps`, `integrations`, `integration_credentials`, `audit_logs`,
`tools`, and `agent_tools`. This is fail-closed for ordinary roles but is not a
complete authorization design.

The repository migration `0002_tenant_rls.sql` instead uses
`current_setting('app.organization_id', true)` for a smaller table set. The
live policies and repository migration therefore conflict and must not be
blindly merged or deleted.

## Required test matrix

Using the non-owner application role and two real organizations, verify for
each tenant-owned/child table:

```text
RLS enabled | policy exists | SELECT | INSERT | UPDATE USING
UPDATE WITH CHECK | DELETE | parent tenant check | cross-tenant denied
```

The test must set `SET LOCAL app.organization_id` inside a transaction and
prove that a pooled connection reused by a second organization cannot retain
the first organization's context.

## Current status

**ARCHITECTURE READY FOR IMPLEMENTATION; RLS VERIFICATION BLOCKED**

The identity model is selected, but no request-scoped context exists in the
application and the live policies use a different identity model. No policy
was modified.
