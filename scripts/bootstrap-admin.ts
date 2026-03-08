/**
 * One-time bootstrap: create or update the single admin user in admin_user table.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from env; hashes password with argon2id.
 *
 * Usage (from repo root):
 *   ADMIN_EMAIL=lzdzel@gmail.com ADMIN_PASSWORD='3Whale7!!1' pnpm run bootstrap:admin
 * Or set in .env and run: pnpm run bootstrap:admin
 *
 * Password rules (enforced): min 8, max 15; >=1 uppercase; >=1 number; >=1 special; no spaces.
 */

import "dotenv/config";
import { Pool } from "pg";
import argon2 from "argon2";

function requireEnv(key: string): string {
  const v = process.env[key]?.trim();
  if (v === undefined || v === "") throw new Error(`Missing required env: ${key}`);
  return v;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): { ok: true } | { ok: false; error: string } {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return { ok: false, error: "Email is required." };
  if (!EMAIL_REGEX.test(normalized)) return { ok: false, error: "Invalid email format." };
  return { ok: true };
}

/** Password rules: min 8 max 15, >=1 upper, >=1 number, >=1 special, no spaces. */
function validatePassword(password: string): { ok: true } | { ok: false; error: string } {
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password.length > 15) return { ok: false, error: "Password must be at most 15 characters." };
  if (/\s/.test(password)) return { ok: false, error: "Spaces are not allowed in password." };
  if (!/[A-Z]/.test(password)) return { ok: false, error: "Password must include at least one uppercase letter." };
  if (!/[0-9]/.test(password)) return { ok: false, error: "Password must include at least one number." };
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return { ok: false, error: "Password must include at least one special character." };
  }
  return { ok: true };
}

async function main() {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");
  const databaseUrl = requireEnv("DATABASE_URL");

  const emailResult = validateEmail(email);
  if (!emailResult.ok) {
    console.error(emailResult.error);
    process.exit(1);
  }
  const passwordResult = validatePassword(password);
  if (!passwordResult.ok) {
    console.error(passwordResult.error);
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      `INSERT INTO admin_user (email, password_hash, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = now()`,
      [normalizedEmail, passwordHash]
    );
    console.log("Admin user created or updated for email:", normalizedEmail);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
