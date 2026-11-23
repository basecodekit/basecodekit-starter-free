import { describe, expect, it } from "vitest";
import { isLogoContentType, isLogoKeyForOrg, newLogoKey, sniffImageType } from "./logo-upload";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WEBP")];

describe("sniffImageType", () => {
  it("reads PNG, JPEG and WebP from their signatures", () => {
    expect(sniffImageType(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffImageType(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array(WEBP))).toBe("image/webp");
  });

  it("rejects SVG, HTML, GIF, other RIFF files and short input", () => {
    for (const text of ['<svg xmlns="http://www.w3.org/2000/svg">', "<!doctype html><script>", "GIF89a......"]) {
      expect(sniffImageType(new Uint8Array(Buffer.from(text)))).toBeNull();
    }
    expect(sniffImageType(new Uint8Array([...Buffer.from("RIFF"), 1, 2, 3, 4, ...Buffer.from("WAVE")]))).toBeNull();
    expect(sniffImageType(new Uint8Array(PNG.slice(0, 4)))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("logo keys", () => {
  const orgId = crypto.randomUUID();

  it("accepts only the three image types", () => {
    expect(isLogoContentType("image/png")).toBe(true);
    expect(isLogoContentType("image/svg+xml")).toBe(false);
    expect(isLogoContentType("toString")).toBe(false);
    expect(isLogoContentType(undefined)).toBe(false);
  });

  it("issues keys inside the org's prefix that it then recognizes", () => {
    const key = newLogoKey(orgId, "image/webp");
    expect(key).toMatch(new RegExp(`^orgs/${orgId}/logo/[0-9a-f-]{36}\\.webp$`));
    expect(isLogoKeyForOrg(key, orgId)).toBe(true);
  });

  it("rejects another org's key, traversal and other shapes", () => {
    const other = newLogoKey(crypto.randomUUID(), "image/png");
    expect(isLogoKeyForOrg(other, orgId)).toBe(false);
    expect(isLogoKeyForOrg(`orgs/${orgId}/logo/../../x/logo/${crypto.randomUUID()}.png`, orgId)).toBe(false);
    expect(isLogoKeyForOrg(`orgs/${orgId}/logo/${crypto.randomUUID()}.svg`, orgId)).toBe(false);
    expect(isLogoKeyForOrg(`orgs/${orgId}/logo/`, orgId)).toBe(false);
    expect(isLogoKeyForOrg(42, orgId)).toBe(false);
  });
});
