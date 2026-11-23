import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { APP_URL } from "@/lib/env";

const APP_ORIGIN = new URL(APP_URL).origin;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * API routes that don't authenticate with the session cookie, so a
 * cross-origin request to them carries no authority the attacker lacks.
 */
export const NON_COOKIE_API_PREFIXES = [
  // Checks the origin itself (Better Auth's `trustedOrigins`).
  "/api/auth/",
];

/**
 * CSRF guard for every other API route: a request that changes state must
 * come from this app's own pages. Browsers send `Origin` on every POST, PUT,
 * PATCH and DELETE, so a missing or foreign one is refused. The session
 * cookie's `SameSite=Lax` already blocks other sites; this also blocks a
 * sibling subdomain, which counts as the same site.
 */
function guardApi(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (SAFE_METHODS.has(request.method) || NON_COOKIE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }
  if (request.headers.get("origin") !== APP_ORIGIN) {
    return Response.json({ error: "Cross-origin request refused." }, { status: 403 });
  }
  return NextResponse.next();
}

/**
 * Optimistic gate for signed-in areas: no session cookie → straight to
 * `/login`, carrying the requested path so sign-in lands back on it. It only
 * checks that a cookie exists — the dashboard layout and each page still
 * verify the session for real (`auth.api.getSession` / `requireOrgAccess`).
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return guardApi(request);
  }
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }
  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("callbackURL", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/api/:path*",
    // Every page under `app/(dashboard)` — keep in sync when adding one.
    "/dashboard/:path*",
    "/settings/:path*",
    "/account/:path*",
  ],
};
