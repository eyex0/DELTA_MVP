import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const disabledDb = process.env.DISABLE_DB === "true" || !process.env.DATABASE_URL;

export const pool = disabledDb
  ? null
  : new Pool({ connectionString: process.env.DATABASE_URL! });

export const db = disabledDb ? (undefined as never) : drizzle(pool!, { schema });

export * from "./schema";
export * from "./knowledge";
