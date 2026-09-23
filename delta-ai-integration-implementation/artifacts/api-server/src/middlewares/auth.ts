import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, withTenantTransaction } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string;
        role: string;
        tokenExpiresAt?: number;
      };
    }
  }
}

export type AuthUser = NonNullable<Request["user"]>;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Token mancante" } });
  }

  const token = authHeader.slice("Bearer ".length);
  const jwtSecret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "delta-dev-secret");

  try {
    const payload = jwt.verify(token, jwtSecret) as { userId?: string; exp?: number };
    if (!payload.userId) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Token non valido" } });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Utente non trovato" } });
    }

    await withTenantTransaction(
      { userId: user.id, organizationId: user.organizationId },
      async () => undefined,
    );

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      tokenExpiresAt: payload.exp,
    };
    return next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Token non valido" } });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Ruolo non autorizzato" } });
    }
    return next();
  };
}
