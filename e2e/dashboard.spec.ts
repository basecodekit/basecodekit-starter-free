import { expect, test, type Page } from "@playwright/test";
import { APP_URL } from "@/lib/env";
import { needsEmailPassword } from "./helpers";

/** Step 5.8: the signed-in shell and where each auth state is allowed to go. */

test.skip(...needsEmailPassword);

const password = "correcthorsebattery";

/** A dashboard URL with a query string, and text only that page shows. */
const deepLink = { path: "/settings?tab=members", shows: "Invite a member" };

/** A fresh account, signed in on `page`'s context via the auth API (the UI
 * sign-up flow has its own coverage in auth.spec.ts). */
async function signUp(page: Page, { withOrg }: { withOrg: boolean }) {
  const email = `e2e-dash-${crypto.randomUUID()}@example.com`;
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Dana Dashboard", email, password },
    headers: { origin: APP_URL },
  });
  expect(signUp.ok()).toBe(true);
  const orgName = `Dash Org ${crypto.randomUUID().slice(0, 8)}`;
  if (withOrg) {
    const org = await page.request.post("/api/org", { data: { name: orgName }, headers: { origin: APP_URL } });
    expect(org.ok()).toBe(true);
  }
  return { email, orgName };
}

test("signed-out visit to a dashboard page goes to login and back after sign-in", async ({ page }) => {
  const { email } = await signUp(page, { withOrg: true });
  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: APP_URL } });

  await page.goto(deepLink.path);
  await expect(page).toHaveURL(`/login?callbackURL=${encodeURIComponent(deepLink.path)}`);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(deepLink.path);
  await expect(page.getByText(deepLink.shows)).toBeVisible();
});

test("sign-in lands on the dashboard, and the shell reaches every section", async ({ page }) => {
  const { email, orgName } = await signUp(page, { withOrg: true });
  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: APP_URL } });

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome back, Dana" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Dashboard" });
  await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("heading", { name: orgName, exact: true })).toBeVisible();
});

test("signed-in visitors are sent away from login and signup", async ({ page }) => {
  await signUp(page, { withOrg: true });

  await page.goto("/login");
  await expect(page).toHaveURL("/dashboard");
  await page.goto("/signup");
  await expect(page).toHaveURL("/dashboard");
  // A safe callbackURL (e.g. an invite link) is still honored…
  await page.goto("/login?callbackURL=/settings");
  await expect(page).toHaveURL("/settings");
  // …but never an off-site one.
  await page.goto(`/login?callbackURL=${encodeURIComponent("https://evil.example/phish")}`);
  await expect(page).toHaveURL("/dashboard");
  await page.goto(`/login?callbackURL=${encodeURIComponent("//evil.example")}`);
  await expect(page).toHaveURL("/dashboard");
});

test("a user without an org is pointed to create one", async ({ page }) => {
  await signUp(page, { withOrg: false });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /set up your organization/ })).toBeVisible();
  await page.getByRole("link", { name: "Create organization" }).click();
  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("heading", { name: "Create your organization", exact: true })).toBeVisible();
});

test("the account page opens from the account menu, with or without an org", async ({ page }) => {
  const { email } = await signUp(page, { withOrg: false });

  await page.goto("/dashboard");
  await page.getByLabel("Account menu").click();
  await page.getByRole("link", { name: "Account settings" }).click();
  await expect(page).toHaveURL("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
  await expect(page.getByRole("main").getByText(email).first()).toBeVisible();

  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: APP_URL } });
  await page.goto("/account");
  await expect(page).toHaveURL(`/login?callbackURL=${encodeURIComponent("/account")}`);
});

test("the landing header shows Dashboard when signed in", async ({ page }) => {
  const header = page.getByRole("navigation", { name: "Main" });
  await page.goto("/");
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();

  await signUp(page, { withOrg: true });
  await page.goto("/");
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await header.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("signing out from the account menu ends the session", async ({ page }) => {
  await signUp(page, { withOrg: true });
  await page.goto("/dashboard");

  await page.getByLabel("Account menu").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/dashboard");
  await expect(page).toHaveURL(`/login?callbackURL=${encodeURIComponent("/dashboard")}`);
});
