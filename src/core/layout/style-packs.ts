import type { StylePack } from "@/types/config";

/**
 * Each pack's color scheme, matching its CSS in `src/styles/packs/`: `auto`
 * follows the visitor's light/dark preference, `dark` is always dark. Brand
 * overrides use this to apply their dark-mode color to dark-only packs.
 */
export const STYLE_PACK_COLOR_SCHEME: Record<StylePack, "auto" | "dark"> = {
  minimal: "auto",
};
