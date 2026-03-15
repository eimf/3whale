/**
 * POST /api/auth/logout
 * Clears auth cookie and returns { ok: true }. Client should redirect to /login.
 */

import { NextResponse } from "next/server";
import { clearAuthCookieHeader } from "@/lib/auth-server";

export async function POST() {
  const cookieHeader = clearAuthCookieHeader();
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("Set-Cookie", cookieHeader);
  return res;
}
