/**
 * POST /api/auth/login
 * Body: { email, password }. Validates format, looks up admin_user, verifies argon2, sets JWT cookie.
 */

import { NextResponse } from "next/server";
import { validateEmail, validatePassword } from "@/lib/auth-validation";
import {
  getAdminByEmail,
  verifyPassword,
  signJwt,
  setAuthCookieHeader,
} from "@/lib/auth-server";

const UNKNOWN_MSG = "Unknown error. Please try again.";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    const emailResult = validateEmail(email);
    if (!emailResult.ok) {
      return NextResponse.json({ error: emailResult.error }, { status: 400 });
    }
    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) {
      return NextResponse.json({ error: passwordResult.error }, { status: 400 });
    }

    const admin = await getAdminByEmail(emailResult.email);
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(admin.password_hash, password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await signJwt({ sub: admin.email });
    const cookieHeader = setAuthCookieHeader(token);
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set("Set-Cookie", cookieHeader);
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: UNKNOWN_MSG },
      { status: 500 }
    );
  }
}
