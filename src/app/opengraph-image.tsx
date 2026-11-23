import { siteConfig } from "@/config/site.config";
import { brand } from "@/core/brand";
import { brandShareImage, SHARE_IMAGE_SIZE } from "@/core/brand/images";

export const alt = `${siteConfig.name}: ${siteConfig.description}`;
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

/** Link-preview image from `siteConfig` (see core/brand/images). X and
 * others fall back to Open Graph, so there's no separate twitter-image. */
export default function OpengraphImage() {
  return brandShareImage(brand, siteConfig.description);
}
