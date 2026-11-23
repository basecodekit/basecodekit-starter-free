import { describe, expect, it } from "vitest";
import {
  DARK_TEXT,
  LIGHT_TEXT,
  contrastRatio,
  parseColor,
  readableForeground,
  toHex,
} from "./color";

const hexOf = (value: string) => toHex(parseColor(value)!);
const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe("parseColor", () => {
  it("reads #rgb and #rrggbb, normalizing case", () => {
    expect(hexOf("#FA0")).toBe("#ffaa00");
    expect(hexOf("#1d4ed8")).toBe("#1d4ed8");
    expect(parseColor(" #ABCDEF ")?.css).toBe("#abcdef");
  });

  it("converts oklch to the matching sRGB hex", () => {
    // #3b82f6 is oklch(62.3% 0.188 259.8) in sRGB (±2 per channel for rounding).
    const actual = channels(hexOf("oklch(62.3% 0.188 259.8)"));
    channels("#3b82f6").forEach((expected, i) =>
      expect(Math.abs(actual[i]! - expected)).toBeLessThanOrEqual(2),
    );
    expect(hexOf("oklch(1 0 0)")).toBe("#ffffff");
    expect(hexOf("oklch(0 0 0)")).toBe("#000000");
    expect(hexOf("oklch(0.6 0.2 30deg)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each([
    "red",
    "#12",
    "#12345g",
    "rgb(0, 0, 0)",
    "oklch(1.2 0 0)",
    "oklch(0.5 0.1)",
    "#fff; } body { display: none",
    "</style>",
  ])("rejects %s", (value) => expect(parseColor(value)).toBeNull());
});

describe("contrast", () => {
  it("matches WCAG's extremes", () => {
    expect(contrastRatio(parseColor("#000")!, parseColor("#fff")!)).toBeCloseTo(
      21,
      5,
    );
    expect(contrastRatio(parseColor("#777")!, parseColor("#777")!)).toBe(1);
  });

  it("picks light text on dark colors and dark text on light ones", () => {
    expect(readableForeground(parseColor("#1e3a8a")!).color).toBe(LIGHT_TEXT);
    expect(readableForeground(parseColor("#facc15")!).color).toBe(DARK_TEXT);
  });
});
