import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { authConfig } from "@/config/auth.config";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { base32Decode, needsEmailPassword } from "./helpers";

/** `/account`: profile, password, two-factor, sessions and deleting the
 * account, driven through the real UI. `?tab=` opens a section in the pro
 * layout; the top-nav layout shows every section and ignores it. */

test.skip(...needsEmailPassword);

const password = "correcthorsebattery";

async function signUp(request: APIRequestContext, { withOrg = false } = {}) {
  const email = `e2e-account-${crypto.randomUUID()}@example.com`;
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "Avery Account", email, password },
    headers: { origin: APP_URL },
  });
  expect(response.ok()).toBe(true);
  if (withOrg) {
    const org = await request.post("/api/org", {
      data: { name: `Account Org ${crypto.randomUUID().slice(0, 8)}` },
      headers: { origin: APP_URL },
    });
    expect(org.ok()).toBe(true);
  }
  return email;
}

function signIn(request: APIRequestContext, email: string, withPassword = password) {
  return request.post("/api/auth/sign-in/email", { data: { email, password: withPassword }, headers: { origin: APP_URL } });
}

async function openSection(page: Page, tab: string) {
  await page.goto(`/account?tab=${tab}`);
  await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
}

test("renames the account and changes the password", async ({ page }) => {
  const email = await signUp(page.request);

  await openSection(page, "profile");
  await page.getByLabel("Name", { exact: true }).fill("Avery Renamed");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect.poll(async () => (await (await page.request.get("/api/auth/get-session")).json()).user.name).toBe("Avery Renamed");

  await openSection(page, "security");
  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("New password", { exact: true }).fill("a-brand-new-passphrase");
  await page.getByLabel("Confirm new password").fill("a-brand-new-passphrase");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  expect((await signIn(page.request, email)).ok()).toBe(false);
  expect((await signIn(page.request, email, "a-brand-new-passphrase")).ok()).toBe(true);
});

test("turns two-factor on and off after sign-up", async ({ page }) => {
  test.skip(!authConfig.totpMfa, "authConfig.totpMfa is off");
  await signUp(page.request);
  // Verifying and disabling rotate the session cookie. Wait for those
  // responses before asking for the session: a get-session sent with the
  // old token answers with a cleared cookie, and if it lands after the new
  // one it signs this browser out for good.
  const settled = (path: string) => page.waitForResponse((response) => response.url().includes(`/api/auth${path}`));
  const twoFactorEnabled = async () => (await (await page.request.get("/api/auth/get-session")).json())?.user.twoFactorEnabled;

  await openSection(page, "security");
  await page.getByRole("button", { name: "Enable an authenticator app" }).click();
  await page.getByLabel("Confirm your password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Can't scan it? Enter this key manually:")).toBeVisible();
  const secret = base32Decode(await page.locator("code").innerText());
  const { code } = await auth.api.generateTOTP({ body: { secret } });
  await page.getByLabel("6-digit code").fill(code);
  const verified = settled("/two-factor/verify-totp");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await verified;

  // Backup codes, shown once.
  await expect(page.getByText("They are shown only once, right now.")).toBeVisible();
  await page.getByRole("button", { name: "I saved them" }).click();
  await expect.poll(twoFactorEnabled).toBe(true);

  await page.getByRole("button", { name: "Turn off" }).click();
  await page.getByLabel("Confirm your password").fill(password);
  const disabled = settled("/two-factor/disable");
  await page.getByRole("button", { name: "Turn off" }).click();
  await disabled;
  await expect.poll(twoFactorEnabled).toBe(false);
});

test("signs another browser out from the sessions list", async ({ page, browser }) => {
  const email = await signUp(page.request);
  const other = await browser.newContext();
  expect((await signIn(other.request, email)).ok()).toBe(true);

  await openSection(page, "sessions");
  await expect(page.getByText("This device")).toBeVisible();
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  await expect(signOut).toHaveCount(1);
  const revoked = page.waitForResponse((response) => response.request().method() === "DELETE");
  await signOut.click();
  expect((await revoked).status()).toBe(204);
  await expect(page.getByRole("button", { name: /^(Sign out|Signing out…)$/ })).toHaveCount(0);

  expect(await (await other.request.get("/api/auth/get-session")).json()).toBeNull();
  // This browser stays signed in.
  expect(await (await page.request.get("/api/auth/get-session")).json()).not.toBeNull();
  await other.close();
});

test("deletes the account, and the org it was the only member of", async ({ page }) => {
  const email = await signUp(page.request, { withOrg: true });

  await openSection(page, "delete");
  await expect(page.getByText(/so it is deleted along with your account/)).toBeVisible();
  await page.getByRole("button", { name: "Delete account…" }).click();
  const confirm = page.getByRole("button", { name: "Delete permanently" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/to confirm/).fill("delete my account");
  await confirm.click();

  await expect(page).not.toHaveURL(/\/account/);
  expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
  expect((await signIn(page.request, email)).ok()).toBe(false);
});
