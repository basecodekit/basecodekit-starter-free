import { STYLE_PACK_COLOR_SCHEME } from "@/core/layout/style-packs";
import type { SiteConfig } from "@/types/config";
import {
  type ParsedColor,
  parseColor,
  readableForeground,
  toHex,
} from "./color";

export class BrandConfigError extends Error {
  constructor(problems: string[]) {
    super(
      `site.config.ts brand is invalid:\n${problems.map((p) => `✖ ${p}`).join("\n")}`,
    );
    this.name = "BrandConfigError";
  }
}

export interface ResolvedBrand {
  name: string;
  logo: {
    src: string;
    absoluteUrl: string;
    alt: string;
    hideName: boolean;
  } | null;
  /** `brand.icon`, for the generated favicon and app icons. */
  icon: { src: string } | null;
  /** Rules for the `brand` CSS layer (after `packs`), or "" with no color override. */
  css: string;
  /** Hex values and an absolute logo URL, for email clients. */
  email: { primary: string; primaryForeground: string; logoUrl: string | null };
  /** Valid but worth fixing, e.g. low contrast. Logged at startup. */
  warnings: string[];
}

/** The unbranded email button colors (the token defaults, in hex). */
const DEFAULT_EMAIL = { primary: "#18181b", primaryForeground: "#ffffff" };
/** What the icon and share-image renderer (Satori) can draw. */
const RENDERABLE_IMAGE = /\.(png|jpe?g|svg)$/i;
/** WCAG AA for normal-size text. */
const MIN_CONTRAST = 4.5;

const isPath = (src: string) => /^\/(?!\/)/.test(src);
const isHttpsUrl = (src: string) => {
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
};

function tokens(primary: ParsedColor): string {
  const foreground = readableForeground(primary).color;
  return `--primary: ${primary.css}; --primary-foreground: ${foreground.css}; --ring: ${primary.css};`;
}

/**
 * Resolves `siteConfig.brand` into what the app renders. Throws a
 * `BrandConfigError` listing every problem, so a typo'd color or a logo URL
 * the CSP would block stops the app instead of shipping half-branded.
 */
export function resolveBrand(
  site: Pick<SiteConfig, "name" | "url" | "brand">,
): ResolvedBrand {
  const brand = site.brand ?? {};
  const problems: string[] = [];
  const warnings: string[] = [];

  let logo: ResolvedBrand["logo"] = null;
  if (brand.logo) {
    const { src, alt, hideName = false } = brand.logo;
    if (!isPath(src) && !isHttpsUrl(src)) {
      problems.push(
        `logo.src "${src}" must be a path under public/ (e.g. "/logo.svg") or an https:// URL`,
      );
    } else {
      logo = {
        src,
        absoluteUrl: new URL(src, site.url).href,
        alt: alt?.trim() || site.name,
        hideName,
      };
    }
  }

  let icon: ResolvedBrand["icon"] = null;
  if (brand.icon !== undefined) {
    if (!isPath(brand.icon) && !isHttpsUrl(brand.icon)) {
      problems.push(
        `icon "${brand.icon}" must be a path under public/ (e.g. "/icon.png") or an https:// URL`,
      );
    } else if (!RENDERABLE_IMAGE.test(new URL(brand.icon, site.url).pathname)) {
      problems.push(`icon "${brand.icon}" must be a .png, .jpg or .svg file`);
    } else {
      icon = { src: brand.icon };
    }
  }

  const parse = (key: "primaryColor" | "primaryColorDark") => {
    const value = brand[key];
    if (value === undefined) return null;
    const parsed = parseColor(value);
    if (!parsed) {
      problems.push(`${key} "${value}" is not #rgb, #rrggbb or oklch(L C H)`);
      return null;
    }
    const { contrast } = readableForeground(parsed);
    if (contrast < MIN_CONTRAST) {
      warnings.push(
        `${key} ${parsed.css}: button text reaches ${contrast.toFixed(1)}:1 contrast, below WCAG AA ${MIN_CONTRAST}:1`,
      );
    }
    return parsed;
  };
  const light = parse("primaryColor");
  const dark = parse("primaryColorDark") ?? light;
  if (
    brand.primaryColorDark !== undefined &&
    brand.primaryColor === undefined
  ) {
    problems.push("primaryColorDark needs primaryColor too");
  }

  if (problems.length > 0) throw new BrandConfigError(problems);

  let css = "";
  if (light && dark) {
    const darkPacks = Object.entries(STYLE_PACK_COLOR_SCHEME)
      .filter(([, scheme]) => scheme === "dark")
      .map(([pack]) => `[data-style-pack="${pack}"]`);
    // Same-specificity rules: the dark-only packs come last so they win.
    css = [
      `@layer brand {`,
      `:root, [data-style-pack] { ${tokens(light)} }`,
      `@media (prefers-color-scheme: dark) { :root, [data-style-pack] { ${tokens(dark)} } }`,
      ...(darkPacks.length > 0
        ? [`${darkPacks.join(", ")} { ${tokens(dark)} }`]
        : []),
      `}`,
    ].join("\n");
  }

  return {
    name: site.name,
    logo,
    icon,
    css,
    email: light
      ? {
          primary: toHex(light),
          primaryForeground: toHex(readableForeground(light).color),
          logoUrl: logo?.absoluteUrl ?? null,
        }
      : { ...DEFAULT_EMAIL, logoUrl: logo?.absoluteUrl ?? null },
    warnings,
  };
}
