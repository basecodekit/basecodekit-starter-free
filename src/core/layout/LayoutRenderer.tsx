import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { landingContent } from "@/config/landing.config";
import { layoutConfig } from "@/config/layout.config";
import { siteConfig } from "@/config/site.config";
import { HeaderAuthLinks } from "@/components/header-auth-links";
import type { LandingContent, LayoutConfig } from "@/types/config";
import { layoutRegistry } from "./registry";
import { StylePackProvider } from "./style-pack-context";
import { SLOT_ORDER } from "./types";

/**
 * Renders the landing page for the configured archetype and style pack:
 * resolves the archetype's registry entry and renders each slot in
 * `SLOT_ORDER`. `data-style-pack` scopes the pack's CSS variables to this
 * subtree, so `/dev/preview` can show any combination on one page.
 *
 * Every prop defaults to the project's config; overrides exist for the
 * preview route and tests.
 */
export function LayoutRenderer({
  layout = layoutConfig,
  content = landingContent,
}: {
  layout?: LayoutConfig;
  content?: LandingContent;
}) {
  const slots = layoutRegistry[layout.archetype];

  return (
    <StylePackProvider stylePack={layout.stylePack}>
      <div
        data-style-pack={layout.stylePack}
        data-archetype={layout.archetype}
        className="flex min-h-full flex-1 flex-col bg-background bg-page-glow text-foreground"
      >
        <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-md">
          <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="font-heading text-base font-semibold">
              <BrandMark />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              <a href="#features" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:inline">
                Features
              </a>
              <HeaderAuthLinks />
            </div>
          </nav>
        </header>

        <main className="flex-1">
          {SLOT_ORDER.map((slot) => {
            switch (slot) {
              case "hero":
                return <slots.hero key={slot} content={content.hero} />;
              case "features":
                return <slots.features key={slot} content={content.features} />;
              case "faq":
                return <slots.faq key={slot} content={content.faq} />;
            }
          })}
        </main>

        <footer className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
            <p>
              © {new Date().getFullYear()} {siteConfig.name}
            </p>
            <p>{siteConfig.description}</p>
          </div>
        </footer>
      </div>
    </StylePackProvider>
  );
}
