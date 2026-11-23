"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { motionPresets } from "@/core/layout/motion-presets";
import { useStylePack } from "@/core/layout/style-pack-context";

/**
 * Scroll-reveal (and optional hover-lift) wrapper. Animates only when the
 * active style pack has a motion preset; otherwise it's a plain `<div>`, so
 * Minimal ships no motion. Reduced motion is handled by `StylePackProvider`'s
 * `MotionConfig` — never by swapping elements here, since the server can't
 * know the preference and a swap would leave the server's hidden start
 * state stuck on the hydrated element.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds — stagger siblings with `index * 0.05`. */
  delay?: number;
  /** Lift on hover; for cards the visitor can interact with. */
  hover?: boolean;
}) {
  const preset = motionPresets[useStylePack()];
  // Safe to read here: hover doesn't affect server-rendered markup.
  const reducedMotion = useReducedMotion();

  if (!preset) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: preset.reveal.y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: preset.reveal.duration, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hover && !reducedMotion ? { y: -preset.hoverLift, transition: { duration: 0.2 } } : undefined}
    >
      {children}
    </m.div>
  );
}
