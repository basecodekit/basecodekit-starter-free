import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STYLE_PACK_COLOR_SCHEME } from "@/core/layout/style-packs";
import { BrandConfigError, resolveBrand } from "./brand";

const site = { name: "Acme", url: "https://acme.example" };

describe("resolveBrand", () => {
  it("changes nothing without a brand block", () => {
    const brand = resolveBrand(site);
    expect(brand.css).toBe("");
    expect(brand.logo).toBeNull();
    expect(brand.email).toEqual({
      primary: "#18181b",
      primaryForeground: "#ffffff",
      logoUrl: null,
    });
  });

  it("overrides primary, its text color and the focus ring in a layer after the packs", () => {
    const { css, email } = resolveBrand({
      ...site,
      brand: { primaryColor: "#1d4ed8" },
    });
    expect(css.startsWith("@layer brand {")).toBe(true);
    expect(css).toContain(
      ":root, [data-style-pack] { --primary: #1d4ed8; --primary-foreground: oklch(0.985 0 0); --ring: #1d4ed8; }",
    );
    expect(email).toMatchObject({
      primary: "#1d4ed8",
      primaryForeground: "#fafafa",
    });
  });

  it("uses the dark color in dark mode and in every dark-only pack", () => {
    const { css } = resolveBrand({
      ...site,
      brand: {
        primaryColor: "#1d4ed8",
        primaryColorDark: "oklch(0.8 0.12 250)",
      },
    });
    const darkRule =
      "--primary: oklch(0.8 0.12 250); --primary-foreground: oklch(0.205 0 0)";
    expect(css).toMatch(
      new RegExp(
        `@media \\(prefers-color-scheme: dark\\) \\{ :root, \\[data-style-pack\\] \\{ ${darkRule.replace(/[()]/g, "\\$&")}`,
      ),
    );
    for (const [pack, scheme] of Object.entries(STYLE_PACK_COLOR_SCHEME)) {
      if (scheme === "dark")
        expect(css).toContain(`[data-style-pack="${pack}"] { ${darkRule}`);
    }
  });

  it("resolves the logo against the site URL for emails, defaulting alt to the name", () => {
    expect(
      resolveBrand({ ...site, brand: { logo: { src: "/logo.svg" } } }).logo,
    ).toEqual({
      src: "/logo.svg",
      absoluteUrl: "https://acme.example/logo.svg",
      alt: "Acme",
      hideName: false,
    });
    const remote = resolveBrand({
      ...site,
      brand: {
        logo: {
          src: "https://cdn.example/l.png",
          alt: "Acme logo",
          hideName: true,
        },
      },
    });
    expect(remote.email.logoUrl).toBe("https://cdn.example/l.png");
    expect(remote.logo).toMatchObject({ alt: "Acme logo", hideName: true });
  });

  it("lists every problem at once", () => {
    const attempt = () =>
      resolveBrand({
        ...site,
        brand: {
          logo: { src: "//evil.example/x.png" },
          primaryColor: "blue",
          primaryColorDark: "#fff;}",
        },
      });
    expect(attempt).toThrow(BrandConfigError);
    expect(attempt).toThrow(
      /logo\.src[\s\S]*primaryColor "blue"[\s\S]*primaryColorDark "#fff;}"/,
    );
  });

  it.each(["http://cdn.example/logo.png", "javascript:alert(1)", "logo.svg"])(
    "rejects logo src %s",
    (src) => {
      expect(() => resolveBrand({ ...site, brand: { logo: { src } } })).toThrow(
        /logo\.src/,
      );
    },
  );

  it("requires primaryColor when primaryColorDark is set", () => {
    expect(() =>
      resolveBrand({ ...site, brand: { primaryColorDark: "#fff" } }),
    ).toThrow(/needs primaryColor/);
  });

  it("warns, without failing, when button text can't reach WCAG AA contrast", () => {
    const { warnings } = resolveBrand({
      ...site,
      brand: { primaryColor: "#e11d48" },
    });
    expect(warnings).toEqual([
      expect.stringMatching(/^primaryColor #e11d48: .* below WCAG AA 4\.5:1$/),
    ]);
    expect(
      resolveBrand({ ...site, brand: { primaryColor: "#1d4ed8" } }).warnings,
    ).toEqual([]);
  });
});

describe("brand layer wiring", () => {
  const styles = join(__dirname, "..", "..", "styles", "packs");

  it("STYLE_PACK_COLOR_SCHEME matches each pack's CSS", () => {
    for (const [pack, scheme] of Object.entries(STYLE_PACK_COLOR_SCHEME)) {
      const css = readFileSync(join(styles, `${pack}.css`), "utf8");
      expect(/color-scheme:\s*dark/.test(css), pack).toBe(scheme === "dark");
    }
  });

  it("globals.css orders the brand layer after the packs", () => {
    const globals = readFileSync(
      join(__dirname, "..", "..", "app", "globals.css"),
      "utf8",
    );
    expect(globals).toContain("@layer tokens, packs, brand;");
  });
});
