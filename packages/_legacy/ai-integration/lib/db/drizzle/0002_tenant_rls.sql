-- Tenant isolation policies.
-- The API must set app.organization_id for non-service-role database sessions.
-- Supabase service-role connections intentionally bypass RLS and remain protected
-- by the application authorization layer.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects',
    'tasks',
    'agent_runs',
    'execution_jobs',
    'usage_events',
    'workflows',
    'workflow_runs',
    'knowledge_documents',
    'knowledge_memories',
    'agents',
    'approvals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON %I USING (organization_id::text = current_setting(''app.organization_id'', true)) WITH CHECK (organization_id::text = current_setting(''app.organization_id'', true))',
      table_name,
      table_name
    );
  END LOOP;
END $$;
