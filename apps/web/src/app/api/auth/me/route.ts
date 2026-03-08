/**
 * GET /api/auth/me
 * Returns { authenticated: true, email } if valid JWT in cookie; otherwise 401.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieName, verifyJwt } from "@/lib/auth-server";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const payload = await verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    email: payload.sub,
  });
}
