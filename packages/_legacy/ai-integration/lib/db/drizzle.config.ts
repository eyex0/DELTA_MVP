import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl === "DISABLE_DB" || process.env.DISABLE_DB === "true") {
  throw new Error(
    "A real PostgreSQL DATABASE_URL, DIRECT_URL, or DIRECT_DATABASE_URL is required for migrations. Preview mode is not supported.",
  );
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
