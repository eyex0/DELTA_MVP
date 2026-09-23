import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const { Pool } = pg;

// Allow running the server without a real database for local UI preview
// when DATABASE_URL is explicitly set to the sentinel value 'DISABLE_DB'.
// This is a pragmatic local-dev fallback only — production requires a real DB.
const disabledDb = process.env.DATABASE_URL === "DISABLE_DB" ||
  process.env.DISABLE_DB === "true";

if (process.env.NODE_ENV === "production" && disabledDb) {
  throw new Error(
    "Production cannot run with the in-memory database fallback. Configure DATABASE_URL for PostgreSQL.",
  );
}

if (!process.env.DATABASE_URL && !disabledDb) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export let pool: pg.Pool | null = null;
export let db: NodePgDatabase<typeof schema>;

if (disabledDb) {
  // In-memory fallback for local preview-only usage. This keeps the app alive
  // without a live PostgreSQL instance, but it is intentionally non-persistent.
  const memory = new Map<string, Record<string, unknown>[]>();
  const tableName = (table: unknown): string => {
    const symbolName = Symbol.for("drizzle:Name");
    const value = (table as Record<PropertyKey, unknown> | undefined)?.[symbolName]
      ?? (table as { name?: string } | undefined)?.name
      ?? "unknown_table";
    return String(value);
  };

  const readChunkText = (chunk: unknown): string => {
    if (!chunk || typeof chunk !== "object") {
      return "";
    }
    const value = (chunk as { value?: unknown }).value;
    if (Array.isArray(value)) {
      return value.join("");
    }
    if (typeof value === "string") {
      return value;
    }
    return "";
  };

  const toJsKey = (columnName: string) => columnName.replace(/_([a-z])/g, (_, match: string) => match.toUpperCase());

  const extractColumnName = (expr: unknown): string | undefined => {
    if (!expr || typeof expr !== "object") {
      return undefined;
    }
    const sqlLike = expr as { queryChunks?: unknown[]; name?: string };
    if (typeof sqlLike.name === "string") {
      return toJsKey(sqlLike.name);
    }
    if (Array.isArray(sqlLike.queryChunks)) {
      for (const chunk of sqlLike.queryChunks) {
        if (!chunk || typeof chunk !== "object") {
          continue;
        }
        const chunkName = (chunk as { name?: string }).name;
        if (typeof chunkName === "string") {
          return toJsKey(chunkName);
        }
        const childColumn = extractColumnName(chunk);
        if (childColumn) {
          return childColumn;
        }
      }
    }
    return undefined;
  };

  const extractScalarValue = (expr: unknown): unknown => {
    if (!expr || typeof expr !== "object") {
      return undefined;
    }
    const sqlLike = expr as { queryChunks?: unknown[]; value?: unknown };
    if (Object.prototype.hasOwnProperty.call(sqlLike, "value") && sqlLike.value !== undefined) {
      return sqlLike.value;
    }
    if (Array.isArray(sqlLike.queryChunks)) {
      for (const chunk of sqlLike.queryChunks) {
        const value = extractScalarValue(chunk);
        if (value !== undefined) {
          return value;
        }
      }
    }
    return undefined;
  };

  const isOperatorToken = (token: string) => /^(and|or|=|!=|<>|>=|<=|>|<|like|ilike|is|null|not|in|true|false|\(|\))$/i.test(token.trim());

  const flattenSql = (expr: unknown, tokens: Array<string | { type: "column"; name: string } | { type: "value"; value: unknown }> = []): typeof tokens => {
    if (!expr || typeof expr !== "object") {
      return tokens;
    }
    const sqlLike = expr as { queryChunks?: unknown[]; name?: string; value?: unknown };
    if (typeof sqlLike.name === "string") {
      tokens.push({ type: "column", name: sqlLike.name });
      return tokens;
    }
    if (Array.isArray(sqlLike.queryChunks)) {
      for (const chunk of sqlLike.queryChunks) {
        if (!chunk || typeof chunk !== "object") {
          continue;
        }
        const text = readChunkText(chunk);
        if (text.trim() !== "") {
          if (isOperatorToken(text)) {
            tokens.push(text.trim());
          } else {
            tokens.push(text.trim());
          }
        }
        if (Object.prototype.hasOwnProperty.call(chunk, "queryChunks")) {
          flattenSql(chunk, tokens);
          continue;
        }
        if (typeof (chunk as { name?: string }).name === "string") {
          tokens.push({ type: "column", name: (chunk as { name: string }).name });
          continue;
        }
        const value = (chunk as { value?: unknown }).value;
        if (value !== undefined && !Array.isArray(value) && typeof value !== "object") {
          tokens.push({ type: "value", value });
        }
      }
    }
    return tokens;
  };

  const matchesTokenList = (row: Record<string, unknown>, sqlTokens: Array<string | { type: "column"; name: string } | { type: "value"; value: unknown }>): boolean => {
    if (sqlTokens.length === 0) {
      return true;
    }

    const operatorIndex = sqlTokens.findIndex((token) => typeof token === "string" && /^(and|or)$/i.test(String(token).trim()));
    if (operatorIndex >= 0) {
      const operator = String(sqlTokens[operatorIndex]).trim().toLowerCase();
      const left = sqlTokens.slice(0, operatorIndex);
      const right = sqlTokens.slice(operatorIndex + 1);
      const leftMatch = matchesTokenList(row, left as typeof sqlTokens);
      const rightMatch = matchesTokenList(row, right as typeof sqlTokens);
      return operator === "and" ? leftMatch && rightMatch : leftMatch || rightMatch;
    }

    const firstColumn = sqlTokens.find((token): token is { type: "column"; name: string } => typeof token === "object" && token !== null && "type" in token && token.type === "column");
    const firstValue = sqlTokens.find((token): token is { type: "value"; value: unknown } => typeof token === "object" && token !== null && "type" in token && token.type === "value");
    if (!firstColumn || !firstValue) {
      return true;
    }

    const propertyName = toJsKey(firstColumn.name);
    const target = row[propertyName] ?? row[firstColumn.name];
    const value = firstValue.value;
    if (typeof value === "string" && value.startsWith("%") && value.endsWith("%")) {
      return String(target ?? "").toLowerCase().includes(value.slice(1, -1).toLowerCase());
    }
    return target === value;
  };

  const matchesSqlExpression = (row: Record<string, unknown>, expr: unknown): boolean => {
    if (Array.isArray(expr)) {
      return matchesTokenList(row, expr as Array<string | { type: "column"; name: string } | { type: "value"; value: unknown }>);
    }
    if (!expr || typeof expr !== "object") {
      return true;
    }
    return matchesTokenList(row, flattenSql(expr));
  };

  const applyWhere = (rows: Record<string, unknown>[], expr: unknown): Record<string, unknown>[] => {
    if (!expr) {
      return rows;
    }
    const predicate = (row: Record<string, unknown>) => matchesSqlExpression(row, expr);
    return rows.filter(predicate);
  };

  const applyOrderBy = (rows: Record<string, unknown>[], orderExpr: unknown): Record<string, unknown>[] => {
    if (!orderExpr || typeof orderExpr !== "object") {
      return rows;
    }
    const columnName = extractColumnName(orderExpr);
    if (!columnName) {
      return rows;
    }
    const direction = String(orderExpr).toLowerCase().includes("desc") ? "desc" : "asc";
    return [...rows].sort((left, right) => {
      const leftValue = left[columnName];
      const rightValue = right[columnName];
      if (leftValue === rightValue) {
        return 0;
      }
      const result = leftValue == null ? -1 : rightValue == null ? 1 : String(leftValue).localeCompare(String(rightValue));
      return direction === "desc" ? -result : result;
    });
  };

  const applyLimit = (rows: Record<string, unknown>[], limit?: number): Record<string, unknown>[] => {
    if (typeof limit !== "number") {
      return rows;
    }
    return rows.slice(0, limit);
  };

  const createSelectChain = (initialRows: Record<string, unknown>[] = []) => {
    let rows = [...initialRows];
    let whereExpression: unknown;
    let orderExpression: unknown;
    let limitValue: number | undefined;

    const finalize = () => {
      let finalRows = [...rows];
      if (whereExpression) {
        finalRows = applyWhere(finalRows, whereExpression);
      }
      if (orderExpression) {
        finalRows = applyOrderBy(finalRows, orderExpression);
      }
      if (typeof limitValue === "number") {
        finalRows = applyLimit(finalRows, limitValue);
      }
      return finalRows;
    };

    const chain: any = {
      then: (onFulfilled?: ((input: Record<string, unknown>[]) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(finalize()).then(onFulfilled ?? undefined, onRejected ?? undefined),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) => Promise.resolve(finalize()).catch(onRejected ?? undefined),
      finally: (onFinally?: (() => void) | null) => Promise.resolve(finalize()).finally(onFinally ?? undefined),
      from: (table: unknown) => {
        rows = [...(memory.get(tableName(table)) ?? [])];
        return chain;
      },
      where: (...args: unknown[]) => {
        const filters = args.filter(Boolean);
        if (filters.length > 0) {
          whereExpression = filters.length === 1 ? filters[0] : {
            queryChunks: filters.flatMap((filter, index) => index === 0 ? [filter] : [{ queryChunks: [{ value: " and " }] }, filter]),
          };
        }
        return chain;
      },
      orderBy: (...args: unknown[]) => {
        const [first] = args.filter(Boolean);
        if (first) {
          orderExpression = first;
        }
        return chain;
      },
      limit: (count: number) => {
        limitValue = count;
        return chain;
      },
      offset: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      groupBy: () => chain,
      returning: async () => finalize(),
    };

    return chain;
  };

  const createReturningQuery = (rows: Record<string, unknown>[]) => ({
    returning: async () => rows,
  });

  pool = null;
  db = {
    query: async () => ({ rows: [] }),
    execute: async () => ({ rows: [] }),
    select: () => ({
      from: (table: unknown) => createSelectChain(memory.get(tableName(table)) ?? []).from(table),
    }),
    insert: (table: unknown) => ({
      values: (input: Record<string, unknown> | Record<string, unknown>[]) => {
        const key = tableName(table);
        const rows = Array.isArray(input) ? input : [input];
        const prepared = rows.map((row) => ({ ...(row as Record<string, unknown>), id: (row as { id?: string }).id ?? crypto.randomUUID() }));
        memory.set(key, [...(memory.get(key) ?? []), ...prepared]);
        return { ...createReturningQuery(prepared), onConflictDoNothing: () => ({ returning: async () => prepared }) };
      },
      onConflictDoNothing: () => ({
        returning: async () => [] as Record<string, unknown>[],
      }),
    }),
    update: (table: unknown) => ({
      set: (input: Record<string, unknown>) => ({
        where: (condition?: unknown) => {
          const key = tableName(table);
          const rows = (memory.get(key) ?? []).map((row) => {
            if (!condition || matchesSqlExpression(row, condition)) {
              return { ...row, ...input };
            }
            return row;
          });
          memory.set(key, rows);
          return { returning: async () => rows };
        },
        returning: async () => (memory.get(tableName(table)) ?? []),
      }),
    }),
    delete: (table: unknown) => ({
      where: (condition?: unknown) => {
        const key = tableName(table);
        const rows = (memory.get(key) ?? []).filter((row) => !condition || !matchesSqlExpression(row, condition));
        memory.set(key, rows);
        return { returning: async () => rows };
      },
    }),
  } as unknown as NodePgDatabase<typeof schema>;
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5_000),
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000),
  });
  db = drizzle(pool, { schema });
}

export * from "./schema";
export * from "./scoping";
export * from "./knowledge";
export * from "./queue";
export * from "./worker";
export * from "./tenant-context";
