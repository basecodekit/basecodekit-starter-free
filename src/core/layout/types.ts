import type { ComponentType } from "react";
import type { LandingContent } from "@/types/config";

export interface HeroSlotProps {
  content: LandingContent["hero"];
}
export interface FeaturesSlotProps {
  content: LandingContent["features"];
}
export interface FaqSlotProps {
  content: LandingContent["faq"];
}

/** One archetype's components, one per slot. */
export interface ArchetypeSlots {
  hero: ComponentType<HeroSlotProps>;
  features: ComponentType<FeaturesSlotProps>;
  faq: ComponentType<FaqSlotProps>;
}

/** Render order of the landing page's slots. */
export const SLOT_ORDER = [
  "hero",
  "features",
  "faq",
] as const;
