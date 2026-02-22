/**
 * Env configuration. All values are loaded from .env (via dotenv in entrypoints).
 * This module defines what .env must contain and provides typed access.
 */

/** Required: app will fail at startup if missing. */
export const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "REDIS_URL",
  "INTERNAL_API_KEY",
  "SHOPIFY_SHOP_DOMAIN",
  "SHOPIFY_ADMIN_ACCESS_TOKEN",
  "SHOP_TIMEZONE_IANA",
  "SHOP_CURRENCY_CODE",
] as const;

/** Optional: used only for OAuth install callback (/auth/callback). */
export const OPTIONAL_ENV_KEYS_FOR_OAUTH = [
  "SHOPIFY_CLIENT_ID",
  "SHOPIFY_CLIENT_SECRET",
] as const;

/** Optional: have defaults or only used in specific flows. */
export const OPTIONAL_ENV_KEYS = [
  "NODE_ENV",
  "LOG_LEVEL",
  "PORT",
  "APP_URL",
  "SHOPIFY_API_VERSION",
  "SHOPIFY_SYNC_PAGE_SIZE",
  "SHOPIFY_SYNC_OVERLAP_DAYS",
  "SHOPIFY_INITIAL_BACKFILL_DAYS",
  "SHOPIFY_SYNC_CONCURRENCY",
  ...OPTIONAL_ENV_KEYS_FOR_OAUTH,
] as const;

export type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

/** Throws if any required key is missing or empty. Call from entrypoints after dotenv. */
export function ensureRequiredEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV_KEYS) {
    const v = process.env[key]?.trim();
    if (v === undefined || v === "") missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env (from .env): ${missing.join(", ")}`);
  }
}

/** Get env string; undefined if not set. */
export function getEnv(key: string): string | undefined {
  return process.env[key]?.trim();
}

/** Get env string or throw. Use for required keys. */
export function requireEnv(key: string): string {
  const v = getEnv(key);
  if (v === undefined || v === "") throw new Error(`Missing required env: ${key}`);
  return v;
}
