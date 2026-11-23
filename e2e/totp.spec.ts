import { expect, test } from "@playwright/test";
import { auth } from "@/lib/auth";
import { authConfig } from "@/config/auth.config";
import { APP_URL } from "@/lib/env";
import { base32Decode, needsEmailPassword, skipPasskeyPrompt } from "./helpers";

test.skip(...needsEmailPassword);
test.skip(!authConfig.totpMfa, "authConfig.totpMfa is off");

/**
 * TOTP is pure math — unlike Step 1.3's OAuth (no test-mode provider stub
 * exists in the installed `better-auth@1.7.3`) or even Step 1.4's passkeys
 * (needed a CDP virtual authenticator to stand in for a real WebAuthn
 * authenticator), there's no external service or browser API to substitute
 * for here. This drives the real UI end to end: enroll (reading the TOTP
 * secret straight out of the enrollment screen's "can't scan it? enter this
 * key manually" fallback text, the same way a real user would) -> log out
 * -> log back in with a freshly generated code, typed into the real form.
 *
 * `auth.api.generateTOTP` runs here in the Playwright test process itself
 * (not inside the separate `next dev` server `webServer` spawns) — it's a
 * pure function of `{ secret, digits, period }` and the current time (no DB
 * read), so a second `betterAuth()` instance computing it against the same
 * `DATABASE_URL`/config is equivalent to the one running inside the dev
 * server; no network call to any third party is made either way.
 */

test("enroll TOTP, sign out, and sign back in with a generated code", async ({ page }) => {
  const email = `e2e-totp-${crypto.randomUUID()}@example.com`;
  const password = "correcthorsebattery";

  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("TOTP E2E");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  // When authConfig.passkeys is on, signup shows the passkey enrollment
  // step first — not relevant to this test, skip it.
  await skipPasskeyPrompt(page);

  // TOTP enrollment step.
  await expect(page.getByRole("heading", { name: "Add two-factor authentication", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable an authenticator app", exact: true }).click();

  await expect(page.getByText("Can't scan it? Enter this key manually:")).toBeVisible();
  const manualSecretText = await page.locator("code").innerText();
  const rawSecret = base32Decode(manualSecretText);

  const { code: enrollCode } = await auth.api.generateTOTP({ body: { secret: rawSecret } });
  await page.getByPlaceholder("6-digit code").fill(enrollCode);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Two-factor authentication enabled", exact: true })).toBeVisible();
  // Backup codes are shown exactly once, right here.
  const backupCodeCount = await page.getByRole("listitem").count();
  expect(backupCodeCount).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");

  const sessionAfterEnrollment = await page.request.get("/api/auth/get-session");
  const enrolledUser = (await sessionAfterEnrollment.json()).user;
  expect(enrolledUser.email).toBe(email);
  expect(enrolledUser.twoFactorEnabled).toBe(true);

  // No dashboard UI exists yet (Phase 2+), so sign out goes through the API
  // directly — same pattern as e2e/auth.spec.ts and e2e/passkey.spec.ts.
  const signOutResponse = await page.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: APP_URL },
  });
  expect(signOutResponse.ok(), await signOutResponse.text()).toBe(true);
  expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Primary sign-in succeeds, but the account has TOTP enabled, so Better
  // Auth's two-factor plugin intercepts it: no session yet, a second-step
  // challenge instead (see src/app/(auth)/login/page.tsx).
  await expect(page.getByRole("heading", { name: "Two-factor verification", exact: true })).toBeVisible();
  await expect(page).toHaveURL("/login");

  // Generate a fresh code rather than reusing `enrollCode` — real time has
  // passed since enrollment, and a stale code from a prior 30s period could
  // legitimately fall outside the verify window.
  const { code: signInCode } = await auth.api.generateTOTP({ body: { secret: rawSecret } });
  await page.getByPlaceholder("6-digit code").fill(signInCode);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");

  const sessionAfterTwoFactorSignIn = await page.request.get("/api/auth/get-session");
  expect((await sessionAfterTwoFactorSignIn.json()).user.email).toBe(email);
});
