import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { POST } from "./route";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";

// Better Auth's built-in CSRF protection for unauthenticated auth endpoints
// (sign-up/sign-in/magic-link/email-otp) is `formCsrfMiddleware`
// (`better-auth/dist/api/middlewares/origin-check.mjs`), wired via each
// route's own `use: [formCsrfMiddleware]` — confirmed directly against the
// installed `better-auth@1.7.3` source, not assumed. It keys off the Fetch
// Metadata headers (`Sec-Fetch-Site`/`-Mode`/`-Dest`) real browsers send on
// every request:
//   - `Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate` (a literal
//     cross-site top-level form POST) is rejected outright.
//   - Any other combination of those headers being present forces an Origin
//     check against `trustedOrigins` (which defaults to `[baseURL]`, i.e.
//     just this app's own origin — see `better-auth/dist/context/helpers.mjs`
//     `getTrustedOrigins`), so a cross-origin `fetch()`-style POST (the
//     realistic attack shape — an attacker's page `fetch()`-ing this app's
//     API with the victim's cookies) is rejected too.
//
// IMPORTANT, found while writing this test: Better Auth ships its own
// test-mode convenience that defeats a naive version of this test. In
// `better-auth/dist/context/create-context.mjs`:
//   skipOriginCheck: options.advanced?.disableOriginCheck !== undefined
//     ? options.advanced.disableOriginCheck
//     : isTest() ? true : false
// and `isTest()` (`@better-auth/core`'s env helper) is true whenever
// `NODE_ENV === "test"` — which Vitest sets by default. That flag is
// computed once, at `betterAuth()` construction time, and baked into the
// singleton `auth` instance this app's `route.ts` imports; flipping
// `process.env.NODE_ENV` inside a test body afterwards has no effect on it.
// So driving `POST` from `./route` directly (this app's real, already-
// constructed `auth` singleton) against a cross-origin request under Vitest
// silently skips the origin check and would make this test worthless
// (verified empirically: it comes back 401 "invalid credentials", not 403).
//
// This is Better Auth's own test convenience, not a misconfiguration in this
// app's `src/lib/auth.ts` (which never sets `disableOriginCheck`/
// `disableCSRFCheck`) — so the fix isn't to change app config, it's to build
// a second `betterAuth()` instance for this test alone, spreading in the
// exact same options the app singleton was built with (`auth.options` —
// same DB pool, same plugins, same trusted origin) and only overriding
// `advanced.disableOriginCheck: false` to force the real check back on
// regardless of `NODE_ENV`. Same "second instance against the same
// config/DB to reach behavior the app singleton can't exercise under the
// test runner" pattern already used for the TOTP e2e test (see pipeline
// log, Step 1.5).
const csrfEnforcedAuth = betterAuth({
  ...auth.options,
  advanced: {
    ...(auth.options as { advanced?: Record<string, unknown> }).advanced,
    disableOriginCheck: false,
  },
});

function crossOriginSignInAttempt() {
  return csrfEnforcedAuth.handler(
    new Request(`${APP_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example.com",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
      },
      body: JSON.stringify({ email: "victim@example.com", password: "does-not-matter" }),
    }),
  );
}

function crossSiteNavigationSignInAttempt() {
  return csrfEnforcedAuth.handler(
    new Request(`${APP_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example.com",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
      body: JSON.stringify({ email: "victim@example.com", password: "does-not-matter" }),
    }),
  );
}

describe("CSRF protection on POST /api/auth/sign-in/email", () => {
  it("rejects a cross-origin fetch-style sign-in attempt (Origin not in trustedOrigins)", async () => {
    const response = await crossOriginSignInAttempt();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ORIGIN" });
  });

  it("rejects a cross-site top-level navigation (form-post) sign-in attempt", async () => {
    const response = await crossSiteNavigationSignInAttempt();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "CROSS_SITE_NAVIGATION_LOGIN_BLOCKED",
    });
  });

  it("does not reject a same-origin sign-in attempt on CSRF grounds", async () => {
    const response = await csrfEnforcedAuth.handler(
      new Request(`${APP_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: APP_URL,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
        },
        body: JSON.stringify({ email: "no-such-user@example.com", password: "wrong" }),
      }),
    );

    // Wrong credentials for a nonexistent user still fail — but with
    // Better Auth's normal 401 "invalid credentials", not the 403 CSRF
    // rejection above. That distinction is the point of this test.
    expect(response.status).not.toBe(403);
  });
});

describe("Session cookie attributes on a successful sign-up", () => {
  // This one deliberately goes through the real `./route` POST (the app's
  // actual singleton, CSRF bypass under test and all) — cookie attribute
  // derivation (`createCookieGetter` in `better-auth/dist/cookies/index.mjs`)
  // isn't gated by `isTest()`/`skipOriginCheck` at all, so there's no reason
  // to route around the app's real config for this assertion.
  it("sets httpOnly + SameSite=Lax on the session cookie, and Secure iff APP_URL is https", async () => {
    const email = `cookie-attrs-${crypto.randomUUID()}@example.com`;
    const response = await POST(
      new Request(`${APP_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "correct-horse-battery-staple", name: "Cookie Test" }),
      }),
    );

    expect(response.status).toBe(200);

    // Route Handlers on Next.js's Web `Response` may fold multiple
    // `Set-Cookie` values into `getSetCookie()` rather than a single
    // comma-joined header — use whichever the runtime exposes.
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie") ?? ""];
    const sessionCookie = setCookies.find((c) => c.includes("session_token="));
    expect(sessionCookie).toBeDefined();

    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);

    // Better Auth derives `secure`/the `__Secure-` cookie-name prefix from
    // `APP_URL`'s protocol when `advanced.useSecureCookies` isn't set (see
    // `better-auth/dist/cookies/index.mjs`, `createCookieGetter`) — not
    // overridden in `src/lib/auth.ts`. Assert that derivation rather than a
    // hardcoded expectation, so this test is correct in both local dev
    // (`http://localhost`) and any CI/prod run where `BETTER_AUTH_URL` is
    // `https://`.
    const expectSecure = APP_URL.startsWith("https://");
    expect(sessionCookie).toMatch(expectSecure ? /Secure/i : /^(?!.*Secure)/i);
    expect(sessionCookie?.startsWith("__Secure-")).toBe(expectSecure);
  });
});
