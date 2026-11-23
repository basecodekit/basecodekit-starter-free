import { GridFeatures } from "@/components/slots/features/GridFeatures";
import { FaqSection } from "@/components/slots/faq/FaqSection";
import { SaasHero } from "@/components/slots/hero/SaasHero";
import type { LayoutArchetype } from "@/types/config";
import type { ArchetypeSlots } from "./types";


/**
 * Archetype → the component filling each landing-page slot. Adding an
 * archetype is one entry here plus its components; `LayoutArchetype` makes
 * a missing entry a type error. (The story-driven archetype's `StoryHero` is
 * reserved but not registered in v1.)
 */
export const layoutRegistry: Record<LayoutArchetype, ArchetypeSlots> = {
  "saas-hero": {
    hero: SaasHero,
    features: GridFeatures,
    faq: FaqSection,
  },
};
