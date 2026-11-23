import type { DashboardLayout, LayoutConfig } from "@/types/config";

/**
 * The landing page's look, in one place. Change either value and the whole
 * page follows — no component edits:
 *
 * - `archetype`: `"saas-hero"` (headline-led, sticky feature matrix).
 * - `stylePack`: `"minimal"` (clean monochrome).
 */
export const layoutConfig: LayoutConfig = {
  archetype: "saas-hero",
  stylePack: "minimal",
};

/**
 * The signed-in dashboard's chrome. `"topnav"`: section links across the top.
 */
export const dashboardLayout: DashboardLayout = "topnav";
