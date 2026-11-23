import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ResolvedBrand } from "./brand";

/**
 * The favicon, home-screen icon and share image, drawn from the brand by
 * `next/og` (Satori) in its bundled Geist Regular. Rendered at build time,
 * so a `brand` change shows up on the next build like the rest of
 * `site.config.ts`.
 */

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };

/**
 * An image Satori can draw: a `public/` file inlined as a data URL, or an
 * https:// URL as is (fetched at render time). Null for a format it can't
 * draw, such as WebP, so callers fall back instead of failing the build.
 */
export async function renderableImage(src: string): Promise<string | null> {
  const ext = /\.([a-z]+)$/i.exec(new URL(src, "https://x").pathname)?.[1]?.toLowerCase();
  const mime = ext && MIME[ext];
  if (!mime) return null;
  if (src.startsWith("https://")) return src;
  const bytes = await readFile(join(process.cwd(), "public", src));
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** First letter or digit of the name, for the monogram icon. */
export function monogram(name: string): string {
  return /[\p{L}\p{N}]/u.exec(name)?.[0]?.toUpperCase() ?? "•";
}

/**
 * A square app icon: `brand.icon` filling the square, or a monogram on the
 * primary color. `rounded` is for the browser tab; iOS masks the
 * home-screen icon itself, so that one stays square.
 */
export async function brandIcon(brand: ResolvedBrand, size: number, { rounded }: { rounded: boolean }) {
  const image = brand.icon ? await renderableImage(brand.icon.src) : null;
  const { primary, primaryForeground } = brand.email;
  return new ImageResponse(
    image ? (
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      <img src={image} width={size} height={size} style={{ objectFit: "contain" }} />
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: primary,
          color: primaryForeground,
          fontSize: size * 0.62,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        {monogram(brand.name)}
      </div>
    ),
    { width: size, height: size },
  );
}

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

/** The link-preview card: logo (or name), description, a primary-color bar. */
export async function brandShareImage(brand: ResolvedBrand, description: string) {
  const logo = brand.logo ? await renderableImage(brand.logo.src) : null;
  const showName = !logo || !brand.logo?.hideName;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#18181b",
          padding: "72px 80px",
          borderBottom: `24px solid ${brand.email.primary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" height={80} style={{ objectFit: "contain" }} />}
          {showName && <div style={{ fontSize: 56 }}>{brand.name}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 44, lineHeight: 1.3, color: "#52525b" }}>
          {description}
        </div>
      </div>
    ),
    SHARE_IMAGE_SIZE,
  );
}
