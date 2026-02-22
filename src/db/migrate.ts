/**
 * Run migrations from drizzle/*.sql (plain SQL; no journal required).
 * Usage: npx tsx src/db/migrate.ts
 * Loads env from .env; see src/env.ts for required keys.
 */
import "dotenv/config";
import { requireEnv } from "../env.js";
import { Pool } from "pg";
import { readFileSync } from "fs";
import path from "path";

const connectionString = requireEnv("DATABASE_URL");

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function run() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    const migrationFile = path.join(migrationsFolder, "0000_initial_income_v1.sql");
    const sql = readFileSync(migrationFile, "utf-8");
    await client.query(sql);
    console.log("Migrations completed.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
