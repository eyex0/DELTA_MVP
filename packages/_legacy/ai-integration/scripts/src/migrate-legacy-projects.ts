import { db, organizationsTable, projectsTable, usersTable } from "@workspace/db";

export async function migrateLegacyProjects(): Promise<void> {
  const [organization] = await db.insert(organizationsTable).values({ name: "Legacy Demo Org" }).returning();

  const [user] = await db
    .insert(usersTable)
    .values({
      organizationId: organization.id,
      email: "demo@delta.local",
      passwordHash: "legacy-seed",
      role: "delivery_lead",
    })
    .returning();

  await db.insert(projectsTable).values({
    organizationId: organization.id,
    clientName: "Legacy",
    name: "Legacy Project",
    objective: "Seeded from legacy data.",
    status: "discovery",
    createdBy: user.id,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrateLegacyProjects();
  console.log("Legacy migration completed");
}
