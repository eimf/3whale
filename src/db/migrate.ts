/**
 * Run migrations from drizzle/*.sql (plain SQL; no journal required).
 * Usage: pnpm run db:migrate (or: tsx src/db/migrate.ts)
 * Loads env from .env; see src/env.ts for required keys.
 */
import "dotenv/config";
import { requireEnv } from "../env.js";
import { Pool } from "pg";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const connectionString = requireEnv("DATABASE_URL");

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function run() {
    const pool = new Pool({ connectionString });
    const client = await pool.connect();
    try {
        const migrationFiles = readdirSync(migrationsFolder)
            .filter((file) => /^\d+.*\.sql$/.test(file))
            .sort();

        for (const migrationFile of migrationFiles) {
            const migrationPath = path.join(migrationsFolder, migrationFile);
            const sql = readFileSync(migrationPath, "utf-8");
            await client.query(sql);
        }

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
