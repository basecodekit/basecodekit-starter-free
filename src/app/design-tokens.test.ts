import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The token contract from `globals.css`: UI uses semantic utilities only, so
 * a style pack can restyle everything by overriding CSS variables. A raw
 * palette class (`text-zinc-600`, `bg-red-50`, `#1a1a1a`) or a `dark:` color
 * pair hard-codes a look no style pack can reach.
 */

const SRC = join(__dirname, "..");

const PALETTE =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)";
const UTILITY = "(?:bg|text|border|ring|outline|divide|from|via|to|fill|stroke|shadow|decoration|placeholder|caret|accent)";
const FORBIDDEN = [
  new RegExp(`(?<![\\w-])(?:[\\w-]+:)*${UTILITY}-${PALETTE}(?:-\\d{2,3})?(?:/[\\w.\\[\\]]+)?(?![\\w-])`, "g"),
  new RegExp(`(?<![\\w-])(?:[\\w-]+:)*${UTILITY}-\\[(?:#|rgb|hsl|oklch)[^\\]]*\\]`, "g"),
];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    // The flat layout (no src/) makes SRC the project root: skip installs and build output.
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name.startsWith(".") ? [] : tsxFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("design token contract", () => {
  it("UI code uses semantic color tokens, never raw palette classes", () => {
    const violations = tsxFiles(SRC)
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return FORBIDDEN.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => `${relative(SRC, file)}: ${match[0]}`));
      });
    expect(violations).toEqual([]);
  });

  it("catches the classes it's meant to catch", () => {
    const hits = (sample: string) => FORBIDDEN.some((pattern) => new RegExp(pattern.source).test(sample));
    for (const bad of ["text-zinc-600", "dark:bg-zinc-900", "hover:bg-black/[.04]", "bg-white", "border-[#1a1a1a]", "text-red-600"]) {
      expect(hits(`className="${bad}"`), bad).toBe(true);
    }
    for (const good of ["text-muted-foreground", "bg-primary", "border-input", "text-destructive", "bg-success-muted", "text-white-space"]) {
      expect(hits(`className="${good}"`), good).toBe(false);
    }
  });

  it("the system-dark and forced-dark (`data-theme`) blocks set the same tokens", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const declarations = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, selector).toBeGreaterThan(-1);
      const body = css.slice(css.indexOf("{", start + selector.length) + 1, css.indexOf("}", start));
      return body.split(";").map((line) => line.trim()).filter(Boolean);
    };
    const system = declarations('[data-style-pack]:not([data-theme="light"], [data-theme="light"] *)');
    const forced = declarations('[data-theme="dark"] [data-style-pack]:not([data-theme="light"], [data-theme="light"] *)');
    expect(system.length).toBeGreaterThan(10);
    expect(forced).toEqual(system);
  });
});
