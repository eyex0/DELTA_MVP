import { and, eq } from "drizzle-orm";

export type ScopedUser = {
  id: string;
  organizationId: string;
};

export function buildScopedProjectSet(
  organizationProjectIds: string[],
  invitedProjectIds: string[],
): Set<string> {
  return new Set([...organizationProjectIds, ...invitedProjectIds]);
}

export async function scopedProjectIds(user: ScopedUser): Promise<string[]> {
  const [{ db }, { projectMembersTable, projectsTable }] = await Promise.all([
    import("./index.js"),
    import("./schema/index.js"),
  ]);

  const organizationProjects = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.organizationId, user.organizationId));

  const invitedProjects = await db
    .select({ projectId: projectMembersTable.projectId })
    .from(projectMembersTable)
    .innerJoin(
      projectsTable,
      eq(projectsTable.id, projectMembersTable.projectId),
    )
    .where(and(
      eq(projectMembersTable.userId, user.id),
      eq(projectsTable.organizationId, user.organizationId),
    ));

  return [...buildScopedProjectSet(
    organizationProjects.map((project) => project.id),
    invitedProjects.map((project) => project.projectId),
  )];
}

export async function assertProjectAccess(user: ScopedUser, projectId: string): Promise<boolean> {
  const allowed = await scopedProjectIds(user);
  return allowed.includes(projectId);
}

export async function assertWorkspaceAccess(user: ScopedUser, workspaceId: string): Promise<boolean> {
  const [{ db }, { workspaceMembersTable, workspacesTable }] = await Promise.all([
    import("./index.js"),
    import("./schema/index.js"),
  ]);
  const [workspace] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .innerJoin(
      workspaceMembersTable,
      eq(workspaceMembersTable.workspaceId, workspacesTable.id),
    )
    .where(and(
      eq(workspacesTable.id, workspaceId),
      eq(workspacesTable.organizationId, user.organizationId),
      eq(workspaceMembersTable.userId, user.id),
    ));
  return Boolean(workspace);
}

export async function scopeProjectsQuery<T>(
  user: ScopedUser,
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows;
  const allowed = await scopedProjectIds(user);
  return rows.filter((row) => {
    const projectId = (row as Record<string, unknown>).projectId;
    return typeof projectId === "string" && allowed.includes(projectId);
  });
}
