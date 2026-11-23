import { expect, test } from "@playwright/test";
import { landingContent } from "@/config/landing.config";
import { layoutConfig } from "@/config/layout.config";

/** The landing page renders from config. */

test("home renders the configured archetype and style pack", async ({ page }) => {
  await page.goto("/");

  const root = page.locator("[data-archetype]");
  await expect(root).toHaveAttribute("data-archetype", layoutConfig.archetype);
  await expect(root).toHaveAttribute("data-style-pack", layoutConfig.stylePack);
  await expect(page.locator("html")).toHaveAttribute("data-style-pack", layoutConfig.stylePack);
  await expect(page.getByRole("heading", { level: 1, name: landingContent.hero.headline })).toBeVisible();
});

