import { brand } from "@/core/brand";
import { brandIcon } from "@/core/brand/images";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon from `siteConfig.brand` (see core/brand/images). */
export default function AppleIcon() {
  return brandIcon(brand, size.width, { rounded: false });
}
