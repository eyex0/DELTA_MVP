import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, organizationMembersTable, organizationsTable, usersTable, workspaceMembersTable, workspacesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();
const jwtSecret = process.env.JWT_SECRET ?? "delta-dev-secret";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invalidCredentialsHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.V8Jv1n8x5f8F8D1fVQ5s5YyQvHq8N2i";
const entraStateCookie = "delta_entra_state";
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;

function authRateLimitKey(req: Request, email: string): string {
  return `${req.ip ?? "unknown"}:${email}`;
}

function isAuthRateLimited(req: Request, email: string): boolean {
  const key = authRateLimitKey(req, email);
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > AUTH_MAX_ATTEMPTS;
}

function entraConfig() {
  const tenantId = process.env.ENTRA_TENANT_ID ?? "common";
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const redirectUri = process.env.ENTRA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Microsoft Entra authentication is not configured");
  }
  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
  };
}

function safeStateEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

router.post("/auth/register", async (req, res) => {
  const { password, organization_name } = req.body ?? {};
  const email = normalizeEmail(req.body?.email);

  if (isAuthRateLimited(req, email || "invalid")) {
    return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many authentication attempts" } });
  }
  if (!emailPattern.test(email) || typeof password !== "string" || password.length < 10 || typeof organization_name !== "string" || organization_name.trim().length < 2) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email, password (minimum 10 characters), and organization name are required" } });
  }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, String(email)));
  if (existingUser) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Unable to create account with those details" } });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [organization] = await db.insert(organizationsTable).values({ name: organization_name.trim() }).returning();
  const [user] = await db
    .insert(usersTable)
    .values({
      organizationId: organization.id,
      email: String(email),
      passwordHash,
      role: "delivery_lead",
    })
    .returning();
  await db.insert(organizationMembersTable).values({
    organizationId: organization.id,
    userId: user.id,
    role: "owner",
  });
  const [workspace] = await db.insert(workspacesTable).values({
    organizationId: organization.id,
    name: `${organization.name} Workspace`,
    slug: `default-${user.id.slice(0, 8)}`,
    createdBy: user.id,
  }).returning();
  await db.insert(workspaceMembersTable).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role, organizationId: organization.id, workspaceId: workspace.id } });
});

router.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (isAuthRateLimited(req, email || "invalid")) {
    return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many authentication attempts" } });
  }
  if (!emailPattern.test(email) || typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Valid email and password are required" } });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? invalidCredentialsHash);
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } });
  }

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

router.get("/auth/entra/start", (req, res) => {
  try {
    const config = entraConfig();
    const state = randomBytes(32).toString("hex");
    res.cookie(entraStateCookie, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      response_mode: "query",
      scope: "openid profile email User.Read",
      state,
    });
    return res.redirect(`${config.authorizeUrl}?${params.toString()}`);
  } catch (error) {
    return res.status(503).json({ error: { code: "ENTRA_NOT_CONFIGURED", message: error instanceof Error ? error.message : "External authentication is unavailable" } });
  }
});

router.get("/auth/entra/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const expectedState = req.cookies?.[entraStateCookie];
  res.clearCookie(entraStateCookie);
  if (!code || !state || !expectedState || !safeStateEquals(state, expectedState)) {
    return res.status(400).send("Invalid Microsoft Entra authentication state.");
  }

  try {
    const config = entraConfig();
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        scope: "openid profile email User.Read",
      }),
    });
    if (!tokenResponse.ok) {
      return res.status(401).send("Microsoft Entra authentication failed.");
    }
    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) return res.status(401).send("Microsoft Entra did not return an access token.");

    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
    });
    if (!graphResponse.ok) return res.status(401).send("Microsoft Entra identity lookup failed.");
    const graphUser = await graphResponse.json() as { mail?: string; userPrincipalName?: string };
    const email = normalizeEmail(graphUser.mail ?? graphUser.userPrincipalName);
    if (!email) return res.status(403).send("Microsoft Entra account has no usable email address.");

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) return res.status(403).send("This Microsoft Entra account is not linked to a DELTA organization.");

    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
    const frontendOrigin = process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() ?? "http://localhost:5173";
    return res.redirect(`${frontendOrigin}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (error) {
    return res.status(502).send(error instanceof Error ? error.message : "External authentication failed.");
  }
});

router.post("/auth/logout", (_req, res) => res.json({ ok: true }));

router.get("/auth/me", requireAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Utente non trovato" } });
  }
  return res.json({ user: req.user });
});

export default router;
