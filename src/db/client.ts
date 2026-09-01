

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

// Next.js dev mode can reload modules frequently. Reuse one connection pool
// during development so we do not create a new pool on every hot reload.
const globalForDb = globalThis as unknown as {
  ffzSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.ffzSql ??
  postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.ffzSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
