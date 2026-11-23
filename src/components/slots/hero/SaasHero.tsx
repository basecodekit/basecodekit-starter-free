import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui";
import type { HeroSlotProps } from "@/core/layout/types";

/** SaaS hero-led: one centered, headline-first message with both CTAs above
 * the fold. */
export function SaasHero({ content }: HeroSlotProps) {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-surface">
          {content.eyebrow}
        </p>
        <h1
          id="hero-heading"
          className="mt-6 font-heading text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl"
        >
          {content.headline}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{content.subheadline}</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href={content.primaryCta.href} size="lg">
            {content.primaryCta.label}
          </ButtonLink>
          <ButtonLink href={content.secondaryCta.href} size="lg" variant="outline">
            {content.secondaryCta.label}
          </ButtonLink>
        </div>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {content.highlights.map((highlight) => (
            <li key={highlight} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              {highlight}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
