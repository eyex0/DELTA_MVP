-- Deterministic development-only fixture. Never run in production.
-- This script is intentionally explicit and contains no credentials.

insert into public.organizations (id, name, slug)
values
  ('00000000-0000-0000-0000-0000000000a1', 'DELTA Test Organization A', 'delta-test-a'),
  ('00000000-0000-0000-0000-0000000000b1', 'DELTA Test Organization B', 'delta-test-b')
on conflict (id) do nothing;

insert into public.users (id, email, name)
values
  ('00000000-0000-0000-0000-0000000000a2', 'user-a@example.test', 'User A'),
  ('00000000-0000-0000-0000-0000000000b2', 'user-b@example.test', 'User B')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'owner', 'active'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 'owner', 'active')
on conflict (organization_id, user_id) do nothing;

insert into public.workspaces (id, organization_id, name, slug, created_by)
values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', 'Workspace A', 'workspace-a', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1', 'Workspace B', 'workspace-b', '00000000-0000-0000-0000-0000000000b2')
on conflict (id) do nothing;

insert into public.agents (id, organization_id, workspace_id, name, slug, created_by)
values
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3', 'Agent A', 'agent-a', '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;

insert into public.agent_versions (id, agent_id, version, system_prompt, status, created_by)
values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a4', 1, 'Deterministic test agent.', 'published', '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;

insert into public.tasks (id, organization_id, workspace_id, title, created_by)
values
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3', 'Task A', '00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;
