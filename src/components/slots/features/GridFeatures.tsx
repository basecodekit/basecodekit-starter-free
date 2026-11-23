import { Reveal } from "@/components/motion/reveal";
import { Icon, SectionHeading } from "@/components/ui";
import type { FeaturesSlotProps } from "@/core/layout/types";

/** SaaS hero-led: a feature matrix beside a sticky intro, so the section's
 * point stays in view while the reader scans the grid. */
export function GridFeatures({ content }: FeaturesSlotProps) {
  return (
    <section id="features" aria-labelledby="features-heading" className="px-4 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_2fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading id="features-heading" heading={content.heading} subheading={content.subheading} align="left" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {content.items.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05} hover className="rounded-xl border bg-card p-6 text-card-foreground shadow-card backdrop-blur-surface">
              <Icon name={item.icon} className="size-6 text-primary" />
              <h3 className="mt-4 font-heading text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
