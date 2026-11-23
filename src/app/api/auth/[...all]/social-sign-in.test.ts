import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { APP_URL } from "@/lib/env";
import { authConfig } from "@/config/auth.config";

// NOTE: better-auth@1.7.3 (the version installed here) does not ship a
// browser-facing "test-mode OAuth stub" that lets a full sign-in-with-Google
// / sign-in-with-GitHub redirect+callback flow run against a fake provider
// without a real network call. `better-auth/test`'s `getTestInstance()` only
// swaps in placeholder client id/secret values for *Better Auth's own*
// internal plugin test suite — it does not stand up a fake
// accounts.google.com/github.com to complete a token exchange against, so it
// can't back a real e2e assertion here either. See the pipeline log entry
// for this ticket for the full investigation and the resulting blocker.
//
// What *is* safe to assert without ever touching the real network: calling
// `/sign-in/social` with `disableRedirect: true` never makes an outbound
// HTTP request — `provider.createAuthorizationURL()` builds the redirect
// target purely locally (see better-auth's `dist/api/routes/sign-in.mjs`).
// This test locks in that the app's `socialProviders` wiring produces a
// correctly-formed authorize URL for each enabled provider, which is the
// one piece of Step 1.3 that unit/integration coverage can actually reach.
function requestSocialSignIn(provider: "google" | "github") {
  return POST(
    new Request(`${APP_URL}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, callbackURL: "/", disableRedirect: true }),
    }),
  );
}

// Each test also skips without its provider's client id: a fresh project
// has none until the buyer creates an OAuth app.
describe("POST /api/auth/sign-in/social", () => {
  it.skipIf(!authConfig.oauth.google || !process.env.GOOGLE_CLIENT_ID)("builds a Google authorize URL pointing back at this app's callback route, with no network call", async () => {
    const response = await requestSocialSignIn("google");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.redirect).toBe(false);

    const url = new URL(body.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/auth/callback/google`);
  });

  it.skipIf(!authConfig.oauth.github || !process.env.GITHUB_CLIENT_ID)("builds a GitHub authorize URL pointing back at this app's callback route, with no network call", async () => {
    const response = await requestSocialSignIn("github");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.redirect).toBe(false);

    const url = new URL(body.url);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(process.env.GITHUB_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/auth/callback/github`);
  });
});
