-- DELTA complete platform schema.
-- Additive migration: preserves phase 3 tables and delta_projects.
-- Tenant identity is derived by the application/Supabase JWT; clients must
-- never be allowed to choose an organization outside that trusted context.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key,
  email text not null,
  name text,
  avatar_url text,
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_unique on public.users (lower(email));

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  assignee_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  author_type text not null check (author_type in ('user','agent','system')),
  author_user_id uuid references public.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null default 'user',
  event_type text not null,
  resource_type text,
  resource_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active',
  system_instructions text,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  version integer not null,
  configuration jsonb not null default '{}'::jsonb,
  system_prompt text not null,
  tool_configuration jsonb not null default '{}'::jsonb,
  model_configuration jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  title text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  agent_id uuid not null references public.agents(id) on delete restrict,
  agent_version_id uuid not null references public.agent_versions(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','waiting_for_tool','waiting_for_approval','waiting_for_input','completed','failed','cancelled','timed_out')),
  trigger_type text not null default 'manual',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  checkpoint jsonb,
  current_step integer,
  retry_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  sequence integer not null,
  step_type text not null,
  status text not null,
  input jsonb,
  output jsonb,
  tool_name text,
  tool_call_id text,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_run_id, sequence)
);
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  role text not null check (role in ('system','user','assistant','tool')),
  message_type text not null default 'text',
  content text not null,
  structured_content jsonb,
  sequence integer not null,
  token_count integer,
  created_at timestamptz not null default now(),
  unique (agent_run_id, sequence)
);
create table if not exists public.execution_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','claimed','completed','failed')),
  priority integer not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.execution_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  event_type text not null,
  sequence integer not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (agent_run_id, sequence)
);
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete cascade,
  agent_step_id uuid references public.agent_steps(id) on delete set null,
  requested_by uuid references public.users(id) on delete set null,
  approval_type text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  reason text,
  requested_action jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_comment text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  idempotency_key text not null,
  request_hash text not null,
  execution_id uuid references public.agent_runs(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (organization_id, idempotency_key)
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('upload','url','integration','manual','api')),
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.knowledge_documents add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.knowledge_documents add column if not exists source_id uuid references public.knowledge_sources(id) on delete set null;
alter table public.knowledge_documents add column if not exists external_id text;
alter table public.knowledge_documents add column if not exists mime_type text;
alter table public.knowledge_documents add column if not exists storage_path text;
alter table public.knowledge_documents add column if not exists content_hash text;
alter table public.knowledge_chunks add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chunk_id uuid not null references public.knowledge_chunks(id) on delete cascade,
  embedding vector(1536) not null,
  model text not null,
  dimensions integer not null check (dimensions = 1536),
  created_at timestamptz not null default now(),
  unique (chunk_id)
);
create index if not exists embeddings_vector_hnsw_idx on public.embeddings using hnsw (embedding vector_cosine_ops);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  memory_type text not null,
  content text not null,
  importance numeric(5,4) not null default 0.5 check (importance between 0 and 1),
  confidence numeric(5,4) check (confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  tool_type text not null,
  schema jsonb not null default '{}'::jsonb,
  risk_level text not null default 'read' check (risk_level in ('read','write','destructive','external_side_effect')),
  status text not null default 'active',
  implementation text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create table if not exists public.agent_tools (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (agent_id, tool_id)
);
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete restrict,
  name text not null,
  status text not null default 'active',
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  secret_reference text not null,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  endpoint text not null,
  direction text not null check (direction in ('inbound','outbound')),
  secret_reference text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'draft',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  version integer not null,
  definition jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workflow_id, version)
);
create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_version_id uuid not null references public.workflow_versions(id) on delete cascade,
  step_key text not null,
  step_type text not null check (step_type in ('ai','tool','condition','transform','wait','approval','webhook','notification','loop')),
  position integer not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_version_id, step_key)
);
create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete restrict,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete restrict,
  triggered_by uuid references public.users(id) on delete set null,
  trigger_type text not null default 'manual',
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.workflow_step_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete restrict,
  status text not null default 'queued',
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  attempt integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('manual','schedule','webhook','event','agent')),
  configuration jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  configuration jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider text,
  external_subscription_id text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  quantity numeric not null default 1,
  unit text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.usage_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usage_date date not null,
  event_type text not null,
  quantity numeric not null default 0,
  unique (organization_id, usage_date, event_type)
);
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  provider text not null,
  model text not null,
  usage_date date not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost numeric,
  unique (organization_id, workspace_id, agent_id, provider, model, usage_date)
);
create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  balance numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  actor_type text not null default 'user',
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create table if not exists public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.model_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  agent_step_id uuid references public.agent_steps(id) on delete set null,
  provider text not null,
  model text not null,
  request_type text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status text not null,
  error text,
  estimated_cost numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.errors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  code text,
  message text not null,
  stack text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null,
  description text,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  input jsonb not null,
  expected_output jsonb,
  expected_tools jsonb,
  expected_behavior text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  agent_version_id uuid not null references public.agent_versions(id) on delete restrict,
  status text not null default 'queued',
  total_cases integer not null default 0,
  passed_cases integer not null default 0,
  failed_cases integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  key text not null,
  description text,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workspace_id, key)
);
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  window_seconds integer not null,
  max_requests integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists workspaces_org_idx on public.workspaces (organization_id);
create index if not exists projects_org_idx on public.projects (organization_id);
create index if not exists tasks_tenant_status_idx on public.tasks (organization_id, workspace_id, project_id, status, created_at desc);
create index if not exists agents_tenant_idx on public.agents (organization_id, workspace_id);
create index if not exists agent_runs_tenant_status_idx on public.agent_runs (organization_id, status, created_at desc);
create index if not exists agent_steps_run_idx on public.agent_steps (agent_run_id, sequence);
create index if not exists execution_jobs_claim_idx on public.execution_jobs (status, available_at, priority desc);
create index if not exists execution_events_run_idx on public.execution_events (agent_run_id, sequence);
create index if not exists conversations_tenant_idx on public.conversations (organization_id, workspace_id, updated_at desc);
create index if not exists conversation_messages_idx on public.conversation_messages (conversation_id, created_at);
create index if not exists memories_scope_idx on public.memories (organization_id, workspace_id, user_id, agent_id, expires_at);
create index if not exists workflow_runs_idx on public.workflow_runs (organization_id, status, created_at desc);
create index if not exists usage_events_idx on public.usage_events (organization_id, created_at desc);
create index if not exists audit_logs_idx on public.audit_logs (organization_id, created_at desc);
create index if not exists model_requests_idx on public.model_requests (organization_id, created_at desc);

create or replace function public.claim_execution_job(worker text, lease_seconds integer default 60)
returns setof public.execution_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id from public.execution_jobs
    where status = 'queued' and available_at <= now()
    order by priority desc, available_at, created_at
    for update skip locked limit 1
  )
  update public.execution_jobs j
  set status = 'claimed', claimed_at = now(), claimed_by = worker,
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      attempts = attempts + 1, updated_at = now()
  from candidate where j.id = candidate.id
  returning j.*;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','organizations','organization_members','workspaces','workspace_members',
    'projects','tasks','comments','attachments','activity_events','agents','agent_versions',
    'conversations','agent_runs','agent_steps','agent_messages','execution_jobs',
    'execution_events','approvals','idempotency_keys','knowledge_sources','knowledge_documents',
    'knowledge_chunks','embeddings','memories','conversation_messages','tools','agent_tools',
    'integrations','integration_connections','integration_credentials','webhooks','workflows',
    'workflow_versions','workflow_steps','workflow_runs','workflow_step_runs','workflow_triggers',
    'plans','subscriptions','usage_events','usage_daily','ai_usage','credits','audit_logs',
    'execution_logs','model_requests','errors','evaluations','evaluation_cases','evaluation_runs',
    'api_keys','feature_flags','system_settings','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Supabase Auth JWTs may carry organization_id. Server-side service-role
-- connections should still enforce the same organization filters explicitly.
do $$
declare t text;
begin
  foreach t in array array[
    'organization_members','workspaces','projects','tasks','comments',
    'attachments','activity_events','agents','agent_runs','agent_steps','agent_messages',
    'execution_jobs','execution_events','approvals','idempotency_keys','knowledge_sources',
    'knowledge_documents','knowledge_chunks','embeddings','memories','conversation_messages',
    'integration_connections','webhooks','workflows','workflow_runs','workflow_step_runs',
    'workflow_triggers','subscriptions','usage_events','usage_daily','ai_usage','credits',
    'execution_logs','model_requests','evaluations','evaluation_runs','api_keys','rate_limits'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_tenant_isolation', t);
    execute format(
      'create policy %I on public.%I using (organization_id is null or organization_id::text = auth.jwt() ->> ''organization_id'') with check (organization_id is null or organization_id::text = auth.jwt() ->> ''organization_id'')',
      t || '_tenant_isolation', t
    );
  end loop;

  drop policy if exists workspace_members_tenant_isolation on public.workspace_members;
  create policy workspace_members_tenant_isolation on public.workspace_members
    using (
      exists (
        select 1
        from public.workspaces w
        where w.id = workspace_members.workspace_id
          and w.organization_id::text = auth.jwt() ->> 'organization_id'
      )
    )
    with check (
      exists (
        select 1
        from public.workspaces w
        where w.id = workspace_members.workspace_id
          and w.organization_id::text = auth.jwt() ->> 'organization_id'
      )
    );
end $$;
