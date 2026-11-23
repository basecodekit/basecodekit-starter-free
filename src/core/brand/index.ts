import { siteConfig } from "@/config/site.config";
import { resolveBrand } from "./brand";

export { BrandConfigError, type ResolvedBrand, resolveBrand } from "./brand";

/** `siteConfig.brand`, validated when this module loads (and so at boot). */
export const brand = resolveBrand(siteConfig);
