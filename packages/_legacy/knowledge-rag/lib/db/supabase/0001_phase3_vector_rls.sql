-- Phase 3 Supabase setup.
-- Run this migration against the project database before enabling a live
-- embedding provider. The application connection must use the same database.

create extension if not exists vector;

create table if not exists public.delta_projects (
  id text primary key,
  name text not null,
  description text not null,
  industry text not null,
  objective text not null,
  status text not null default 'active',
  lifecycle_stage text not null default 'discovery',
  progress integer not null default 0,
  requirements_count integer not null default 0,
  open_decisions integer not null default 0,
  risks integer not null default 0,
  pending_approvals integer not null default 0,
  owner text not null default 'Workspace owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  discovery jsonb,
  requirements jsonb not null default '[]'::jsonb,
  analysis jsonb,
  approvals jsonb not null default '[]'::jsonb,
  plan jsonb,
  activity jsonb not null default '[]'::jsonb,
  traceability jsonb not null default '[]'::jsonb,
  organization_id uuid,
  workspace_id uuid
);

create index if not exists delta_projects_org_idx on public.delta_projects (organization_id);
create index if not exists delta_projects_workspace_idx on public.delta_projects (workspace_id);
create index if not exists delta_projects_status_idx on public.delta_projects (status, lifecycle_stage);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delta_projects_progress_check') then
    alter table public.delta_projects add constraint delta_projects_progress_check check (progress between 0 and 100);
  end if;
end $$;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid,
  title text not null,
  source text not null,
  source_type text not null default 'text',
  content text not null,
  status text not null default 'pending',
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null,
  embedding jsonb,
  embedding_vector vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_id uuid not null references public.knowledge_chunks(id) on delete cascade,
  model text not null,
  dimensions integer not null,
  status text not null default 'pending',
  embedding jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid,
  user_id uuid,
  scope text not null default 'workspace',
  kind text not null default 'note',
  source text not null default 'agent',
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.agent_context (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid,
  user_id uuid,
  request_hash text not null,
  context text not null,
  sources jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_embedding_vector_hnsw_idx
  on public.knowledge_chunks using hnsw (embedding_vector vector_cosine_ops)
  where embedding_vector is not null;

create index if not exists knowledge_chunks_document_idx
  on public.knowledge_chunks (document_id, chunk_index);

create unique index if not exists knowledge_chunks_document_index_unique
  on public.knowledge_chunks (document_id, chunk_index);

create unique index if not exists knowledge_embeddings_chunk_unique
  on public.knowledge_embeddings (chunk_id);

create index if not exists knowledge_documents_search_idx
  on public.knowledge_documents using gin (to_tsvector('simple', title || ' ' || content));

create index if not exists knowledge_chunks_search_idx
  on public.knowledge_chunks using gin (to_tsvector('simple', content));

create index if not exists knowledge_memories_scope_idx
  on public.knowledge_memories (organization_id, project_id, scope, expires_at);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'knowledge_documents_status_check') then
    alter table public.knowledge_documents add constraint knowledge_documents_status_check
      check (status in ('pending', 'processing', 'ready', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'knowledge_embeddings_status_check') then
    alter table public.knowledge_embeddings add constraint knowledge_embeddings_status_check
      check (status in ('pending', 'processing', 'ready', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'knowledge_memories_scope_check') then
    alter table public.knowledge_memories add constraint knowledge_memories_scope_check
      check (scope in ('user', 'workspace', 'agent'));
  end if;
end $$;

create or replace function public.set_knowledge_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_documents_updated_at on public.knowledge_documents;
create trigger knowledge_documents_updated_at
before update on public.knowledge_documents
for each row execute function public.set_knowledge_updated_at();

drop trigger if exists knowledge_memories_updated_at on public.knowledge_memories;
create trigger knowledge_memories_updated_at
before update on public.knowledge_memories
for each row execute function public.set_knowledge_updated_at();

drop trigger if exists delta_projects_updated_at on public.delta_projects;
create trigger delta_projects_updated_at
before update on public.delta_projects
for each row execute function public.set_knowledge_updated_at();

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_organization_id uuid,
  match_project_id uuid default null,
  match_count integer default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  content text,
  source text,
  score real,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    d.id,
    d.title,
    c.content,
    d.source,
    (1 - (c.embedding_vector <=> query_embedding))::real,
    jsonb_build_object('document', d.metadata, 'chunk', c.metadata)
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.organization_id = match_organization_id
    and (match_project_id is null or d.project_id = match_project_id)
    and d.status = 'ready'
    and c.embedding_vector is not null
  order by c.embedding_vector <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

create or replace function public.hybrid_match_knowledge_chunks(
  query_embedding vector(1536),
  query_text text,
  match_organization_id uuid,
  match_project_id uuid default null,
  match_count integer default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  content text,
  source text,
  score real,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidates as (
    select
      c.id as chunk_id,
      d.id as document_id,
      d.title,
      c.content,
      d.source,
      1 - (c.embedding_vector <=> query_embedding) as semantic_score,
      ts_rank_cd(
        to_tsvector('simple', c.content),
        plainto_tsquery('simple', query_text)
      ) as keyword_score,
      d.metadata as document_metadata,
      c.metadata as chunk_metadata
    from public.knowledge_chunks c
    join public.knowledge_documents d on d.id = c.document_id
    where d.organization_id = match_organization_id
      and (match_project_id is null or d.project_id = match_project_id)
      and d.status = 'ready'
      and c.embedding_vector is not null
  )
  select
    chunk_id,
    document_id,
    title,
    content,
    source,
    (0.75 * semantic_score + 0.25 * least(keyword_score, 1))::real,
    jsonb_build_object('document', document_metadata, 'chunk', chunk_metadata)
  from candidates
  order by (0.75 * semantic_score + 0.25 * least(keyword_score, 1)) desc
  limit greatest(1, least(match_count, 20));
$$;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_embeddings enable row level security;
alter table public.knowledge_memories enable row level security;
alter table public.agent_context enable row level security;
alter table public.delta_projects enable row level security;

drop policy if exists delta_projects_tenant_isolation on public.delta_projects;
create policy delta_projects_tenant_isolation on public.delta_projects
  using (
    organization_id is null
    or (auth.jwt() ->> 'organization_id')::uuid = organization_id
  )
  with check (
    organization_id is null
    or (auth.jwt() ->> 'organization_id')::uuid = organization_id
  );

drop policy if exists knowledge_documents_tenant_isolation on public.knowledge_documents;
create policy knowledge_documents_tenant_isolation on public.knowledge_documents
  using ((auth.jwt() ->> 'organization_id')::uuid = organization_id)
  with check ((auth.jwt() ->> 'organization_id')::uuid = organization_id);

drop policy if exists knowledge_chunks_tenant_isolation on public.knowledge_chunks;
create policy knowledge_chunks_tenant_isolation on public.knowledge_chunks
  using (exists (
    select 1 from public.knowledge_documents d
    where d.id = document_id
      and (auth.jwt() ->> 'organization_id')::uuid = d.organization_id
  ));

drop policy if exists knowledge_embeddings_tenant_isolation on public.knowledge_embeddings;
create policy knowledge_embeddings_tenant_isolation on public.knowledge_embeddings
  using (exists (
    select 1 from public.knowledge_documents d
    where d.id = document_id
      and (auth.jwt() ->> 'organization_id')::uuid = d.organization_id
  ));

drop policy if exists knowledge_memories_tenant_isolation on public.knowledge_memories;
create policy knowledge_memories_tenant_isolation on public.knowledge_memories
  using (
    (auth.jwt() ->> 'organization_id')::uuid = organization_id
    and (
      scope = 'workspace'
      or user_id = (auth.uid())::uuid
    )
  )
  with check ((auth.jwt() ->> 'organization_id')::uuid = organization_id);

drop policy if exists agent_context_tenant_isolation on public.agent_context;
create policy agent_context_tenant_isolation on public.agent_context
  using ((auth.jwt() ->> 'organization_id')::uuid = organization_id)
  with check ((auth.jwt() ->> 'organization_id')::uuid = organization_id);
