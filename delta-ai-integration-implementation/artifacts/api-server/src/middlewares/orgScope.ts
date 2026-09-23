import type { NextFunction, Request, Response } from "express";
import { db, deltaProjectsTable, scopedProjectIds } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireOrgMembership(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Token mancante" } });
  }

  const rawProjectId = req.params.projectId ?? req.params.id;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  if (!projectId) {
    return next();
  }
  const allowedIds = await scopedProjectIds(req.user);
  if (
    process.env.DATABASE_URL === "DISABLE_DB" ||
    process.env.DISABLE_DB === "true"
  ) {
    const [previewProject] = await db
      .select({ id: deltaProjectsTable.id })
      .from(deltaProjectsTable)
      .where(eq(deltaProjectsTable.id, projectId))
      .limit(1);
    if (previewProject) {
      return next();
    }
  }
  if (!allowedIds.includes(projectId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Progetto non trovato" } });
  }

  return next();
}
