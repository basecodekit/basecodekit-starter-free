import { describe, expect, it } from "vitest";
import { BrandConfigError, resolveBrand } from "./brand";
import { brandIcon, brandShareImage, monogram, renderableImage } from "./images";

const site = { name: "Acme", url: "https://acme.example" };

/** Width and height from a PNG's IHDR chunk. */
async function pngSize(response: Response) {
  expect(response.headers.get("content-type")).toBe("image/png");
  const bytes = Buffer.from(await response.arrayBuffer());
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("brand.icon", () => {
  it("accepts a public/ path or https URL to a PNG, JPEG or SVG", () => {
    expect(resolveBrand({ ...site, brand: { icon: "/icon.png" } }).icon).toEqual({ src: "/icon.png" });
    expect(resolveBrand({ ...site, brand: { icon: "https://cdn.example/i.svg?v=2" } }).icon?.src).toBe(
      "https://cdn.example/i.svg?v=2",
    );
    expect(resolveBrand(site).icon).toBeNull();
  });

  it("rejects other locations and formats the renderer can't draw", () => {
    for (const icon of ["icon.png", "http://cdn.example/i.png", "/icon.webp", "/icon.ico"]) {
      expect(() => resolveBrand({ ...site, brand: { icon } }), icon).toThrow(BrandConfigError);
    }
  });
});

describe("renderableImage", () => {
  it("inlines a public/ file and passes an https URL through", async () => {
    expect(await renderableImage("/file.svg")).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(await renderableImage("https://cdn.example/logo.png")).toBe("https://cdn.example/logo.png");
  });

  it("returns null for formats it can't draw", async () => {
    expect(await renderableImage("/logo.webp")).toBeNull();
    expect(await renderableImage("https://cdn.example/logo")).toBeNull();
  });
});

describe("generated images", () => {
  it("takes the monogram from the first letter or digit", () => {
    expect(monogram("basecode")).toBe("B");
    expect(monogram("  42 Labs")).toBe("4");
    expect(monogram("—")).toBe("•");
  });

  it("renders icons at the requested size, with and without brand.icon", async () => {
    expect(await pngSize(await brandIcon(resolveBrand(site), 32, { rounded: true }))).toEqual({ width: 32, height: 32 });
    const withIcon = resolveBrand({ ...site, brand: { icon: "/file.svg", primaryColor: "#1d4ed8" } });
    expect(await pngSize(await brandIcon(withIcon, 180, { rounded: false }))).toEqual({ width: 180, height: 180 });
  });

  it("renders the share image at 1200×630 with a logo", async () => {
    const brand = resolveBrand({ ...site, brand: { logo: { src: "/file.svg" } } });
    expect(await pngSize(await brandShareImage(brand, "One codebase."))).toEqual({ width: 1200, height: 630 });
  });
});
