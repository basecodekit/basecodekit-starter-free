"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { createContext, useContext, type ReactNode } from "react";
import { layoutConfig } from "@/config/layout.config";
import type { StylePack } from "@/types/config";

const StylePackContext = createContext<StylePack>(layoutConfig.stylePack);

/** Tells client components (e.g. `<Reveal>`) which pack they render under.
 * Also loads framer-motion's DOM animation features lazily, so pages without
 * motion don't pay for the full bundle, and honors `prefers-reduced-motion`:
 * those visitors get fades only — no movement, no hover lift. */
export function StylePackProvider({ stylePack, children }: { stylePack: StylePack; children: ReactNode }) {
  return (
    <StylePackContext.Provider value={stylePack}>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          {children}
        </LazyMotion>
      </MotionConfig>
    </StylePackContext.Provider>
  );
}

export function useStylePack(): StylePack {
  return useContext(StylePackContext);
}
