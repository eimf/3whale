/**
 * Server-only auth: DB lookup, argon2 verify, JWT sign/verify, cookie config.
 * Do not import from client.
 */

import { Pool } from "pg";
import argon2 from "argon2";
import * as jose from "jose";

const COOKIE_NAME = "auth_token";
const JWT_EXPIRY_HOURS = 24;

export function getAuthCookieName() {
  return COOKIE_NAME;
}

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: JWT_EXPIRY_HOURS * 60 * 60,
  };
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("DATABASE_URL is required for auth");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export type AdminRow = { id: string; email: string; password_hash: string };

export async function getAdminByEmail(email: string): Promise<AdminRow | null> {
  const normalized = email.trim().toLowerCase();
  const p = getPool();
  const res = await p.query<AdminRow>(
    `SELECT id, email, password_hash FROM admin_user WHERE email = $1 LIMIT 1`,
    [normalized]
  );
  return res.rows[0] ?? null;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function signJwt(payload: { sub: string }): Promise<string> {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret) throw new Error("AUTH_JWT_SECRET is required");
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_HOURS}h`)
    .sign(key);
}

export async function verifyJwt(token: string): Promise<{ sub: string } | null> {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret) return null;
  const key = new TextEncoder().encode(secret);
  try {
    const { payload } = await jose.jwtVerify(token, key);
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    return { sub };
  } catch {
    return null;
  }
}

export function clearAuthCookieHeader(): string {
  const opts = getCookieOptions();
  return `${COOKIE_NAME}=; Path=${opts.path}; HttpOnly; SameSite=${opts.sameSite}; Max-Age=0${opts.secure ? "; Secure" : ""}`;
}

export function setAuthCookieHeader(token: string): string {
  const opts = getCookieOptions();
  return `${COOKIE_NAME}=${token}; Path=${opts.path}; HttpOnly; SameSite=${opts.sameSite}; Max-Age=${opts.maxAge}${opts.secure ? "; Secure" : ""}`;
}
