import { SectionHeading } from "@/components/ui";
import type { FaqSlotProps } from "@/core/layout/types";

/** Native `<details>` accordion: keyboard- and screen-reader-accessible
 * with no client JavaScript, and every answer is in the HTML for crawlers. */
export function FaqSection({ content }: FaqSlotProps) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="px-4 py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading id="faq-heading" heading={content.heading} />
        <div className="mt-12 divide-y rounded-2xl border bg-card text-card-foreground shadow-card backdrop-blur-surface">
          {content.items.map((item) => (
            <details key={item.question} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden="true" className="text-xl text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
