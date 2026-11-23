import { expect, test } from "@playwright/test";
import { siteConfig } from "@/config/site.config";

/** Icons, the share image and the auth-page header all come from site.config. */

test("the head links the generated icons and an absolute share image", async ({ page, request }) => {
  await page.goto("/");
  const head = page.locator("head");
  const iconHref = await head.locator('link[rel="icon"]').first().getAttribute("href");
  const appleHref = await head.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  const ogImage = await head.locator('meta[property="og:image"]').getAttribute("content");

  expect(iconHref).toMatch(/^\/icon/);
  expect(appleHref).toMatch(/^\/apple-icon/);
  // Absolute, as crawlers require: siteConfig.url (metadataBase) in a
  // production build, the dev server's own origin under `next dev`.
  expect(ogImage).toMatch(/^https?:\/\/[^/]+\/opengraph-image/);
  await expect(head.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    `${siteConfig.name}: ${siteConfig.description}`,
  );
  await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  // The default Next.js favicon is gone, so nothing competes with the brand icon.
  await expect(head.locator('link[href^="/favicon.ico"]')).toHaveCount(0);

  for (const path of [iconHref!, appleHref!, new URL(ogImage!).pathname + new URL(ogImage!).search]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toBe("image/png");
  }
});

for (const [label, path] of [
  ["login", "/login"],
  ["sign-up", "/signup"],
  ["invite", `/invite/${crypto.randomUUID()}`],
]) {
  test(`the ${label} page shows the brand, linking home`, async ({ page }) => {
    await page.goto(path);
    const home = page.getByRole("banner").getByRole("link", { name: siteConfig.name });
    await expect(home).toBeVisible();
    await home.click();
    await expect(page).toHaveURL("/");
  });
}
