/** Landing-page structure (`src/core/layout/registry.ts`). */
export type LayoutArchetype =
  | "saas-hero"
  ;

/** Visual personality — CSS variable overrides in `src/styles/packs/`. */
export type StylePack =
  | "minimal"
  ;

/** The signed-in dashboard's chrome (`src/components/dashboard/layouts.ts`). */
export type DashboardLayout =
  | "topnav"
  ;


export interface LayoutConfig {
  archetype: LayoutArchetype;
  stylePack: StylePack;
}

export interface LandingLink {
  label: string;
  href: string;
}

/** Icons available to feature cards (`src/components/ui/icon.tsx`). */
export type FeatureIconName =
  | "shield"
  | "users"
  | "zap"
  | "layers"
  | "search"
  | "mail";



/** Everything the landing page says, per slot. Slots render this and
 * nothing else, so copy changes never touch components. */
export interface LandingContent {
  hero: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    primaryCta: LandingLink;
    secondaryCta: LandingLink;
    highlights: string[];
  };
  features: {
    heading: string;
    subheading: string;
    items: { title: string; description: string; icon: FeatureIconName }[];
  };
  faq: {
    heading: string;
    items: { question: string; answer: string }[];
  };
}

/** Whitelabel overrides; everything is optional and falls back to the style pack. */
export interface BrandConfig {
  /**
   * Shown in the landing and dashboard headers and in emails. `src` is a path
   * under `public/` (e.g. `"/logo.svg"`) or an absolute `https://` URL.
   * `hideName` drops the text name beside it, for wordmark logos.
   */
  logo?: { src: string; alt?: string; hideName?: boolean };
  /**
   * A square image for the browser tab and home-screen icons, same `src`
   * rules as `logo` (PNG, JPEG or SVG). Unset: a monogram of the name in
   * the primary color.
   */
  icon?: string;
  /**
   * Overrides the primary token (buttons, links, focus rings) in every style
   * pack. `#rgb`, `#rrggbb` or `oklch(L C H)`. Button text switches between
   * light and dark automatically for contrast.
   */
  primaryColor?: string;
  /** Primary color for dark mode and dark-only packs; defaults to `primaryColor`. */
  primaryColorDark?: string;
}

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  brand?: BrandConfig;
}

export interface AuthFeatureConfig {
  emailPassword: boolean;
  magicLink: boolean;
  oauth: {
    google: boolean;
    github: boolean;
  };
  passkeys: boolean;
  totpMfa: boolean;
}


