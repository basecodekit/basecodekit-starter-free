/**
 * Rules for an org's uploaded logo (Step 7.2), kept free of I/O so the
 * routes and their tests share one definition.
 *
 * SVG is deliberately not accepted: an SVG can carry script, and checking
 * one safely means parsing and sanitizing XML, not reading a signature.
 * A developer can still use an SVG through `siteConfig.brand.logo`, a file
 * they control.
 */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export type LogoContentType = keyof typeof LOGO_TYPES;

export function isLogoContentType(value: unknown): value is LogoContentType {
  return typeof value === "string" && Object.hasOwn(LOGO_TYPES, value);
}

/** How many leading bytes `sniffImageType` needs. */
export const SNIFF_BYTES = 12;

/**
 * The image type a file's own bytes say it is, from its signature, or
 * null. This is what the server trusts, never the browser's MIME type.
 */
export function sniffImageType(bytes: Uint8Array): LogoContentType | null {
  const starts = (sig: number[], offset = 0) =>
    bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  // "RIFF" <4-byte size> "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

const logoPrefix = (orgId: string) => `orgs/${orgId}/logo/`;

/** A fresh, unguessable object key inside the org's own logo prefix. */
export function newLogoKey(orgId: string, type: LogoContentType): string {
  return `${logoPrefix(orgId)}${crypto.randomUUID()}.${LOGO_TYPES[type]}`;
}

/**
 * Whether `key` is one `newLogoKey` could have issued for this org. The
 * confirm step takes the key back from the browser, so this is what stops
 * one org from claiming an object under another org's prefix.
 */
export function isLogoKeyForOrg(key: unknown, orgId: string): key is string {
  if (typeof key !== "string" || !key.startsWith(logoPrefix(orgId))) return false;
  const rest = key.slice(logoPrefix(orgId).length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/.test(rest);
}
