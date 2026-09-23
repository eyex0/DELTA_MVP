import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString === "DISABLE_DB") {
  throw new Error("DATABASE_URL must point to PostgreSQL for the tenant context regression test.");
}

const pool = new pg.Pool({ connectionString, max: 4 });
const tenantA = "00000000-0000-0000-0000-00000000000a";
const tenantB = "00000000-0000-0000-0000-00000000000b";

async function runTenantTransaction(tenantId: string, shouldFail = false): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.organization_id', $1, true)", [tenantId]);
    const result = await client.query<{ organization_id: string | null }>(
      "select current_setting('app.organization_id', true) as organization_id",
    );
    if (shouldFail) {
      await client.query("rollback");
      return null;
    }
    await client.query("commit");
    return result.rows[0]?.organization_id ?? null;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

try {
  const requests = Array.from({ length: 100 }, (_, index) => {
    const tenant = index % 2 === 0 ? tenantA : tenantB;
    return runTenantTransaction(tenant);
  });
  const results = await Promise.all(requests);
  for (const [index, result] of results.entries()) {
    const expected = index % 2 === 0 ? tenantA : tenantB;
    if (result !== expected) {
      throw new Error(`Tenant context leaked at request ${index}: expected ${expected}, got ${result}`);
    }
  }

  const failed = await runTenantTransaction(tenantA, true);
  if (failed !== null) {
    throw new Error("Failed transaction unexpectedly returned a tenant context.");
  }

  const afterFailure = await runTenantTransaction(tenantB);
  if (afterFailure !== tenantB) {
    throw new Error(`Tenant context was not reset after rollback: ${afterFailure}`);
  }

  console.log("tenant context regression passed");
} finally {
  await pool.end();
}
