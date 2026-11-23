import { brand } from "@/core/brand";
import { brandIcon } from "@/core/brand/images";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser-tab icon from `siteConfig.brand` (see core/brand/images). */
export default function Icon() {
  return brandIcon(brand, size.width, { rounded: true });
}
