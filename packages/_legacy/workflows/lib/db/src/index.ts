import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const createFallbackDb = () => ({
  select: () => ({
    from: () => ({
      where: async () => [],
      limit: async () => [],
      orderBy: async () => [],
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: async () => [],
    }),
  }),
  update: () => ({
    set: () => ({
      where: async () => [],
    }),
  }),
  delete: () => ({
    where: async () => [],
  }),
}) as any;

const disabledDb = process.env.DATABASE_URL === "DISABLE_DB" || process.env.DISABLE_DB === "true";

export let pool: pg.Pool | null = null;
export let db: any = createFallbackDb();

if (process.env.DATABASE_URL && !disabledDb) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
}

export * from "./schema";
export * from "./workflows";
