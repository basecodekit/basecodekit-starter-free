/**
 * The color math behind brand overrides: parse a configured color, convert it
 * to hex for email clients (which don't understand `oklch()`), and pick the
 * text color with the better WCAG contrast on top of it.
 *
 * Accepted formats: `#rgb`, `#rrggbb`, and `oklch(L C H)` with L as 0–1 or a
 * percentage — the same space the design tokens use.
 */

type Rgb = [number, number, number];

export interface ParsedColor {
  /** The value as written, safe to emit in CSS (format-checked). */
  css: string;
  /** Gamma-encoded sRGB, each channel 0–1, clamped to the sRGB gamut. */
  rgb: Rgb;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const OKLCH =
  /^oklch\(\s*(\d*\.?\d+)(%?)\s+(\d*\.?\d+)\s+(-?\d*\.?\d+)(?:deg)?\s*\)$/i;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const encode = (linear: number) =>
  clamp01(
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055,
  );
const decode = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** OKLCH → sRGB, via OKLab and LMS (Björn Ottosson's reference matrices). */
function oklchToRgb(l: number, c: number, hueDegrees: number): Rgb {
  const h = (hueDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3) as Rgb;
  const [L, M, S] = lms;
  return [
    encode(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    encode(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    encode(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  ];
}

/** Returns null for anything that isn't a supported, well-formed color. */
export function parseColor(value: string): ParsedColor | null {
  const css = value.trim();
  const hex = HEX.exec(css);
  if (hex) {
    const digits =
      hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join("") : hex[1]!;
    const rgb = [0, 2, 4].map(
      (i) => parseInt(digits.slice(i, i + 2), 16) / 255,
    ) as Rgb;
    return { css: css.toLowerCase(), rgb };
  }
  const oklch = OKLCH.exec(css);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    if (lightness > 1) return null;
    return {
      css,
      rgb: oklchToRgb(lightness, Number(oklch[3]), Number(oklch[4])),
    };
  }
  return null;
}

export function toHex({ rgb }: ParsedColor): string {
  return `#${rgb
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG 2 relative luminance. */
function luminance({ rgb }: ParsedColor): number {
  const [r, g, b] = rgb.map(decode) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: ParsedColor, b: ParsedColor): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** The token defaults' near-white and near-black foregrounds. */
export const LIGHT_TEXT = parseColor("oklch(0.985 0 0)")!;
export const DARK_TEXT = parseColor("oklch(0.205 0 0)")!;

/** Whichever of the two text colors reads better on `background`. */
export function readableForeground(background: ParsedColor): {
  color: ParsedColor;
  contrast: number;
} {
  const light = contrastRatio(background, LIGHT_TEXT);
  const dark = contrastRatio(background, DARK_TEXT);
  return light >= dark
    ? { color: LIGHT_TEXT, contrast: light }
    : { color: DARK_TEXT, contrast: dark };
}
