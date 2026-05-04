import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Database client initialization.
 * 
 * NOTE: We avoid throwing an error at the top level if DATABASE_URL is missing.
 * This prevents 'next build' from failing during static analysis on Vercel
 * when environment variables might not be fully available.
 */
const connectionString = process.env.DATABASE_URL;

// Singleton pattern for the database pool to prevent multiple connections in development
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool = globalForDb.pool ?? new Pool({
  connectionString: connectionString,
});

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
