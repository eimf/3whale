/**
 * Edge-safe JWT verify for middleware. No Node-only deps (no pg, argon2).
 */

import * as jose from "jose";

const COOKIE_NAME = "auth_token";
const JWT_EXPIRY_HOURS = 24;

export function getAuthCookieName() {
  return COOKIE_NAME;
}

export async function verifyJwtEdge(token: string): Promise<{ sub: string } | null> {
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
