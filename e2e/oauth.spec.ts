import { expect, test } from "@playwright/test";
import { authConfig } from "@/config/auth.config";
import { APP_URL } from "@/lib/env";

// Better Auth's client redirects the browser to the provider's real
// authorize URL via `window.location.href = url` (see
// `better-auth/dist/client/fetch-plugins.mjs`'s `redirectPlugin`) — there is
// no test-mode OAuth stub in the installed better-auth version (1.7.3) that
// swaps in a fake provider to complete this navigation against. So this test
// intercepts and aborts the outbound navigation request to the real
// provider's domain before it ever leaves the machine, and asserts on the
// intercepted request's URL instead of letting it hit Google/GitHub. This is
// the closest e2e coverage available without violating "never hit real
// providers in CI" — see the pipeline log entry for this ticket for the full
// investigation and the resulting blocker on true stubbed-provider e2e.

test("clicking Google sign-in redirects toward Google's real authorize endpoint, intercepted before any network call", async ({
  page,
}) => {
  test.skip(!authConfig.oauth.google || !process.env.GOOGLE_CLIENT_ID, "Google sign-in is off or GOOGLE_CLIENT_ID is unset");
  await page.route("https://accounts.google.com/**", (route) => route.abort());

  await page.goto("/login");
  const [request] = await Promise.all([
    page.waitForRequest("https://accounts.google.com/**"),
    page.getByRole("button", { name: "Sign in with Google" }).click(),
  ]);

  const url = new URL(request.url());
  expect(url.pathname).toBe("/o/oauth2/v2/auth");
  expect(url.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/auth/callback/google`);
});

test("clicking GitHub sign-in redirects toward GitHub's real authorize endpoint, intercepted before any network call", async ({
  page,
}) => {
  test.skip(!authConfig.oauth.github || !process.env.GITHUB_CLIENT_ID, "GitHub sign-in is off or GITHUB_CLIENT_ID is unset");
  await page.route("https://github.com/**", (route) => route.abort());

  await page.goto("/login");
  const [request] = await Promise.all([
    page.waitForRequest("https://github.com/**"),
    page.getByRole("button", { name: "Sign in with GitHub" }).click(),
  ]);

  const url = new URL(request.url());
  expect(url.pathname).toBe("/login/oauth/authorize");
  expect(url.searchParams.get("redirect_uri")).toBe(`${APP_URL}/api/auth/callback/github`);
});
