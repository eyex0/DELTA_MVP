import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, organizationMembersTable, pool } from "./index";

export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TenantIdentity = {
  userId: string;
  organizationId: string;
};

/**
 * Runs work in a transaction whose tenant setting is local to the checked-out
 * pooled connection. The organization is accepted only after the caller has
 * authenticated the user; membership is rechecked inside this transaction.
 */
export async function withTenantTransaction<T>(
  identity: TenantIdentity,
  work: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!pool) {
    const [membership] = await db
      .select({ organizationId: organizationMembersTable.organizationId })
      .from(organizationMembersTable)
      .where(and(
        eq(organizationMembersTable.userId, identity.userId),
        eq(organizationMembersTable.organizationId, identity.organizationId),
      ));

    if (!membership) {
      throw new Error("Authenticated user is not a member of the requested organization");
    }

    return work(db as TenantTransaction);
  }

  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ organizationId: organizationMembersTable.organizationId })
      .from(organizationMembersTable)
      .where(and(
        eq(organizationMembersTable.userId, identity.userId),
        eq(organizationMembersTable.organizationId, identity.organizationId),
      ));

    if (!membership) {
      throw new Error("Authenticated user is not a member of the requested organization");
    }

    await tx.execute(sql`select set_config('app.organization_id', ${membership.organizationId}, true)`);
    return work(tx);
  });
}
