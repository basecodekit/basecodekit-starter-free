import type { StylePack } from "@/types/config";

/** How a style pack moves. `null` = no motion: content renders static. */
export interface MotionPreset {
  /** Scroll reveal: offset it rises from, and duration in seconds. */
  reveal: { y: number; duration: number };
  /** Hover lift for interactive cards, in px. */
  hoverLift: number;
}

/**
 * Motion belongs to the style pack, not the component: slots wrap content in
 * `<Reveal>` and this table decides whether and how it animates. A pack
 * mapped to `null` (Minimal) stays still by design.
 */
export const motionPresets: Record<StylePack, MotionPreset | null> = {
  minimal: null,
};
