/**
 * Postgres connection and Drizzle instance for income v1 sync.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export { pool };
export * from "./schema.js";
