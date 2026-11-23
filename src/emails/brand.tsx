import { Img } from "@react-email/components";
import type { ResolvedBrand } from "@/core/brand";

export type EmailBrand = ResolvedBrand["email"];

/** Unbranded defaults, so templates render on their own (e.g. in previews). */
export const DEFAULT_EMAIL_BRAND: EmailBrand = {
  primary: "#18181b",
  primaryForeground: "#ffffff",
  logoUrl: null,
};

/** The whitelabel logo above an email's heading, when one is configured. */
export function EmailLogo({ brand, alt }: { brand: EmailBrand; alt: string }) {
  if (!brand.logoUrl) return null;
  return (
    <Img
      src={brand.logoUrl}
      alt={alt}
      height="32"
      style={{ marginBottom: "16px" }}
    />
  );
}
