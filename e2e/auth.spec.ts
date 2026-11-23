import { expect, test } from "@playwright/test";
import { APP_URL } from "@/lib/env";
import { needsEmailPassword, signUpThroughUi } from "./helpers";

test.skip(...needsEmailPassword);

test("sign up, sign out, sign in", async ({ page }) => {
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  const password = "correcthorsebattery";

  await page.goto("/signup");
  // Clicks past the post-signup passkey/TOTP prompts when they're on - not
  // relevant to this password-only flow.
  await signUpThroughUi(page, { name: "E2E Test", email, password });
  await expect(page).toHaveURL("/dashboard");

  const sessionAfterSignUp = await page.request.get("/api/auth/get-session");
  expect((await sessionAfterSignUp.json()).user.email).toBe(email);

  // No dashboard UI exists yet (Phase 2+), so sign out goes through the API
  // directly, sharing the page's browser context/cookies.
  const signOutResponse = await page.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: APP_URL },
  });
  expect(signOutResponse.ok(), await signOutResponse.text()).toBe(true);

  const sessionAfterSignOut = await page.request.get("/api/auth/get-session");
  expect(await sessionAfterSignOut.json()).toBeNull();

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");

  const sessionAfterSignIn = await page.request.get("/api/auth/get-session");
  expect((await sessionAfterSignIn.json()).user.email).toBe(email);
});
