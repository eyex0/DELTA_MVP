# DELTA database architecture

PostgreSQL/Supabase is the canonical durable store. Every tenant resource carries
`organization_id`; workspace resources additionally carry `workspace_id`. API
authorization derives these values from the authenticated execution context, not
from LLM/tool arguments.

## Domains and relationships

```text
users ──< organization_members >── organizations ──< workspaces ──< workspace_members
                                                        │
                                                        ├──< projects ──< tasks ──< comments
                                                        ├──< agents ──< agent_versions
                                                        │                  │
                                                        │                  └──< agent_runs
                                                        │                       ├──< agent_steps
                                                        │                       ├──< agent_messages
                                                        │                       ├──< execution_events
                                                        │                       ├──< execution_jobs
                                                        │                       └──< approvals
                                                        ├──< conversations ──< conversation_messages
                                                        ├──< knowledge_sources ──< knowledge_documents
                                                        │                              └──< knowledge_chunks ──< embeddings
                                                        ├──< memories
                                                        ├──< workflows ──< workflow_versions ──< workflow_steps
                                                        │       └──< workflow_runs ──< workflow_step_runs
                                                        └──< integrations/connections ──< webhooks
```

## Table inventory

- **Identity:** `users`, `organizations`, `organization_members`, `workspaces`,
  `workspace_members`.
- **Core:** `projects` (new UUID model), legacy-compatible `delta_projects`,
  `tasks`, `comments`, `attachments`, `activity_events`.
- **Agents:** `agents`, `agent_versions`, `agent_runs`, `agent_steps`,
  `agent_messages`, `execution_jobs`, `execution_events`, `approvals`,
  `idempotency_keys`.
- **Knowledge/memory:** `knowledge_sources`, `knowledge_documents`,
  `knowledge_chunks`, `embeddings`, legacy-compatible `knowledge_embeddings`,
  `memories`, `knowledge_memories`, `conversations`, `conversation_messages`,
  `agent_context`.
- **Tools/integrations:** `tools`, `agent_tools`, `integrations`,
  `integration_connections`, `integration_credentials`, `webhooks`.
- **Workflows:** `workflows`, `workflow_versions`, `workflow_steps`,
  `workflow_runs`, `workflow_step_runs`, `workflow_triggers`.
- **Billing/usage:** `plans`, `subscriptions`, `usage_events`, `usage_daily`,
  `ai_usage`, `credits`.
- **Observability/evaluation:** `audit_logs`, `execution_logs`, `model_requests`,
  `errors`, `evaluations`, `evaluation_cases`, `evaluation_runs`.
- **System/security:** `api_keys`, `feature_flags`, `system_settings`,
  `rate_limits`.

## Runtime persistence

`agent_runs` is the canonical execution record. A worker claims one
`execution_jobs` row using `FOR UPDATE SKIP LOCKED`, writes ordered
`agent_steps`/`agent_messages`, appends authenticated `execution_events`, and
creates `approvals` when a human decision is required. `idempotency_keys`
prevents duplicate execution creation.

## RAG and memory

`knowledge_sources -> knowledge_documents -> knowledge_chunks -> embeddings`
supports ingestion and pgvector retrieval. The existing Phase 3 tables remain
backward compatible while the normalized `embeddings` table is introduced.
`memories` stores selectively retained user, workspace, agent, conversation, or
organization context with importance, confidence, and expiration.

## Security and retention

Tenant tables have RLS enabled and organization policies based on
`auth.jwt() ->> 'organization_id'`. Server-side service-role connections must
still apply organization filters. API keys store only a hash and display prefix;
integration credentials store a secret reference, never plaintext credentials.
High-volume events, model requests, audit logs, and usage events are indexed by
tenant and time for retention jobs and keyset pagination.

## Existing-to-target mapping

| Existing | Target | Action |
| --- | --- | --- |
| `delta_projects` | legacy project API compatibility | KEEP |
| `knowledge_documents` | normalized knowledge hierarchy | MODIFY |
| `knowledge_chunks` | normalized knowledge hierarchy | MODIFY |
| `knowledge_embeddings` | `embeddings` | KEEP and CREATE normalized table |
| `knowledge_memories` | `memories` | KEEP for compatibility and CREATE normalized table |
| `agent_context` | execution/context cache | KEEP |

The additive migrations do not destroy existing data. Production rollout should
backfill organization/workspace ownership before making legacy columns
non-nullable.
