import { brand } from "@/core/brand";

/**
 * The product's logo and/or name, from `siteConfig` — used wherever the
 * app names itself. A plain `<img>`: logos are small, often SVG, with any
 * aspect ratio, so the image optimizer adds nothing.
 *
 * `orgLogo` (an org's uploaded logo) replaces the logo and the name, so a
 * whitelabeled org's dashboard shows only its own brand.
 */
export function BrandMark({
  className = "",
  orgLogo,
}: {
  className?: string;
  orgLogo?: { src: string; alt: string } | null;
}) {
  const { logo, name } = brand;
  if (orgLogo) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={orgLogo.src} alt={orgLogo.alt} className="h-7 w-auto" />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.src}
          alt={logo.hideName ? logo.alt : ""}
          className="h-7 w-auto"
        />
      )}
      {!logo?.hideName && <span>{name}</span>}
    </span>
  );
}
