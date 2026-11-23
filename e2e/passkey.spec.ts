import { expect, test } from "@playwright/test";
import { authConfig } from "@/config/auth.config";
import { APP_URL } from "@/lib/env";
import { needsEmailPassword, skipTotpPrompt } from "./helpers";

test.skip(...needsEmailPassword);
test.skip(!authConfig.passkeys, "authConfig.passkeys is off");

/**
 * Drives a real register -> sign-out -> sign-in-with-passkey flow using
 * Chrome DevTools Protocol's WebAuthn domain (Playwright doesn't expose a
 * higher-level helper for this in @playwright/test@1.63.0, per the
 * `Protocol.CommandParameters` shapes checked directly against the installed
 * `playwright-core` types). A CDP virtual authenticator behaves like a real
 * platform authenticator (Touch ID / Windows Hello) from the page's
 * perspective — `navigator.credentials.create()`/`.get()` resolve against it
 * with no manual gesture required, since `automaticPresenceSimulation` and
 * `isUserVerified` are both set. No real hardware or browser UI involved, and
 * no outbound network call beyond this app itself.
 */
test("register a passkey and sign in with it", async ({ page }) => {
  const email = `e2e-passkey-${crypto.randomUUID()}@example.com`;
  const password = "correcthorsebattery";

  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable", { enableUI: false });
  const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("Passkey E2E");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  // Signup succeeded and, because authConfig.passkeys is on, the page shows
  // the post-signup enrollment step (no dashboard/settings UI exists yet to
  // host this instead - see src/app/(auth)/signup/page.tsx).
  await expect(page.getByRole("heading", { name: "Add a passkey", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add a passkey", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Passkey added", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // When authConfig.totpMfa is on, a TOTP enrollment prompt follows the
  // passkey step - not relevant to this passkey-only flow, skip it.
  await skipTotpPrompt(page);
  await expect(page).toHaveURL("/dashboard");

  const sessionAfterRegistration = await page.request.get("/api/auth/get-session");
  expect((await sessionAfterRegistration.json()).user.email).toBe(email);

  // No dashboard UI exists yet (Phase 2+), so sign out goes through the API
  // directly, sharing the page's browser context/cookies - same pattern as
  // e2e/auth.spec.ts.
  const signOutResponse = await page.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: APP_URL },
  });
  expect(signOutResponse.ok(), await signOutResponse.text()).toBe(true);

  const sessionAfterSignOut = await page.request.get("/api/auth/get-session");
  expect(await sessionAfterSignOut.json()).toBeNull();

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with a passkey", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");

  const sessionAfterPasskeySignIn = await page.request.get("/api/auth/get-session");
  expect((await sessionAfterPasskeySignIn.json()).user.email).toBe(email);

  await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
});
