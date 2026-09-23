const isProduction = process.env.NODE_ENV === "production";

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || /^(replace-with|your-|placeholder|change-me)/i.test(value)) {
    throw new Error(`Missing required production configuration: ${name}`);
  }
  return value;
}

export function validateProductionConfig(): void {
  if (!isProduction) return;

  const databaseUrl = requireValue("DATABASE_URL");
  if (databaseUrl === "DISABLE_DB" || process.env.DISABLE_DB === "true") {
    throw new Error("Production cannot run with the in-memory database fallback. Configure DATABASE_URL for PostgreSQL.");
  }

  const jwtSecret = requireValue("JWT_SECRET");
  if (jwtSecret.length < 32 || jwtSecret === "delta-dev-secret" || jwtSecret.includes("placeholder")) {
    throw new Error("JWT_SECRET must be a long, production-only secret.");
  }

  const authProvider = process.env.AUTH_PROVIDER ?? "local";
  if (authProvider === "entra") {
    requireValue("ENTRA_TENANT_ID");
    requireValue("ENTRA_CLIENT_ID");
    requireValue("ENTRA_CLIENT_SECRET");
    requireValue("ENTRA_REDIRECT_URI");
  } else if (authProvider === "local") {
    throw new Error("Production requires AUTH_PROVIDER=entra. Local password authentication is only supported for preview and development.");
  } else {
    throw new Error(`Unsupported AUTH_PROVIDER: ${authProvider}`);
  }

  const provider = requireValue("AI_PROVIDER").toLowerCase();
  if (provider === "foundry") {
    requireValue("FOUNDRY_ENDPOINT");
    requireValue("FOUNDRY_API_KEY");
    requireValue("FOUNDRY_DEPLOYMENT");
  } else if (provider === "nvidia") {
    requireValue("NVIDIA_API_KEY");
    requireValue("NVIDIA_BASE_URL");
    requireValue("NVIDIA_MODEL");
  } else {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  requireValue("FRONTEND_ORIGIN");
}
