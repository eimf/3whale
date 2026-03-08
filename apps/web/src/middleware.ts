import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCookieName, verifyJwtEdge } from "@/lib/auth-jwt-edge";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
]);
const PUBLIC_API_PREFIX = "/api/auth/login";
const STATIC_PREFIXES = ["/_next/", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/file.svg", "/window.svg", "/vercel.svg"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname === PUBLIC_API_PREFIX || pathname.startsWith(PUBLIC_API_PREFIX + "?")) return true;
  if (STATIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(getAuthCookieName())?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyJwtEdge(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(getAuthCookieName());
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and _next (Next.js internals).
     * We still allow _next and static in the matcher and then allowlist in logic
     * so that we don't block them.
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
