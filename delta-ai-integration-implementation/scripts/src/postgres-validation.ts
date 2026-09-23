import pg from "pg";

const requiredTables = [
  "users",
  "organizations",
  "organization_members",
  "workspaces",
  "workspace_members",
  "projects",
  "tasks",
  "agents",
  "agent_versions",
  "agent_runs",
  "agent_steps",
  "agent_messages",
  "execution_jobs",
  "approvals",
  "knowledge_documents",
  "knowledge_chunks",
  "knowledge_memories",
  "workflows",
  "workflow_runs",
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString === "DISABLE_DB") {
  console.error("BLOCKED: DATABASE_URL must point to a real PostgreSQL/Supabase database.");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString, max: 2 });
try {
  const client = await pool.connect();
  try {
    const tables = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const actual = new Set(tables.rows.map((row) => row.table_name));
    const missing = requiredTables.filter((table) => !actual.has(table));
    if (missing.length) {
      console.error(`BLOCKED: missing tables: ${missing.join(", ")}`);
      process.exitCode = 1;
    }

    const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = any($1::text[])`,
      [requiredTables],
    );
    const unprotected = rls.rows.filter((row) => ["projects", "tasks", "agent_runs", "execution_jobs", "workflows", "workflow_runs", "knowledge_documents", "knowledge_memories", "agents", "approvals"].includes(row.relname) && !row.relrowsecurity);
    if (unprotected.length) {
      console.error(`BLOCKED: RLS is not enabled on: ${unprotected.map((row) => row.relname).join(", ")}`);
      process.exitCode = 1;
    }

    const extensions = await client.query<{ extname: string }>(
      "select extname from pg_extension where extname in ('vector', 'pgcrypto')",
    );
    const journal = await client.query<{ exists: boolean }>(
      `select exists(
         select 1
         from information_schema.tables
         where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
       )`,
    );
    const policyCount = await client.query<{ count: string }>(
      `select count(*)::text as count
       from pg_policies
       where schemaname = 'public'`,
    );
    console.log(JSON.stringify({
      status: process.exitCode ? "FAILED" : "REAL DATABASE MIGRATION — VERIFIED",
      tables: requiredTables.length - missing.length,
      rlsProtected: unprotected.length === 0,
      extensions: extensions.rows.map((row) => row.extname),
      drizzleJournalPresent: journal.rows[0]?.exists ?? false,
      publicPolicyCount: Number(policyCount.rows[0]?.count ?? 0),
    }, null, 2));
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
