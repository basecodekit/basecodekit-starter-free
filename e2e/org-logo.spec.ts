import { expect, test } from "@playwright/test";
import { APP_URL } from "@/lib/env";
import { needsEmailPassword } from "./helpers";

/**
 * Step 7.2 against the real bucket: upload through the settings page, the
 * logo replaces the brand in the dashboard header, and a file that only
 * claims to be an image is refused. Skipped when R2 isn't configured.
 */
test.skip(!process.env.R2_BUCKET, "R2_* not set");
test.skip(...needsEmailPassword);

// A valid 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function ownerOnSettings(page: import("@playwright/test").Page) {
  const email = `e2e-logo-${crypto.randomUUID()}@example.com`;
  const signUp = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Lola Logo", email, password: "correcthorsebattery" },
    headers: { origin: APP_URL },
  });
  expect(signUp.ok()).toBe(true);
  const orgName = `Logo Org ${crypto.randomUUID().slice(0, 8)}`;
  expect((await page.request.post("/api/org", { data: { name: orgName }, headers: { origin: APP_URL } })).ok()).toBe(true);
  await page.goto("/settings");
  return orgName;
}

test("an owner uploads a logo, it brands the dashboard, and removing it restores the default", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (msg) => msg.type() === "error" && problems.push(msg.text()));
  page.on("pageerror", (err) => problems.push(err.message));

  const orgName = await ownerOnSettings(page);
  await page.locator("#org-logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });

  const headerLogo = page.locator("header").getByRole("img", { name: orgName, exact: true });
  await expect(headerLogo).toBeVisible();
  const src = await headerLogo.getAttribute("src");
  expect(src?.startsWith(`${process.env.R2_PUBLIC_URL}/orgs/`)).toBe(true);
  // Loaded through the CSP from the bucket, not just present in the DOM.
  await expect.poll(() => headerLogo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(headerLogo).toHaveCount(0);
  expect((await page.request.get(src!)).status()).toBe(404);
  expect(problems).toEqual([]);
});

test("a file that only claims to be a PNG is refused after upload", async ({ page }) => {
  await ownerOnSettings(page);
  await page.locator("#org-logo-input").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("<html><script>alert(1)</script></html>"),
  });
  await expect(page.getByText("That file isn't a valid PNG, JPEG or WebP image.")).toBeVisible();
  // No org logo from the bucket; a site.config logo, if any, may still show.
  await expect(page.locator(`header img[src^="${process.env.R2_PUBLIC_URL}/"]`)).toHaveCount(0);
});
