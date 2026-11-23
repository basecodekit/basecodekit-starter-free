import { describe, expect, it } from "vitest";
import { SIGNED_IN_HOME, safeCallbackURL } from "./safe-redirect";

describe("safeCallbackURL", () => {
  it.each(["/invite/abc123", "/settings?tab=members", "/settings#members", "/dashboard"])("keeps same-origin path %s", (path) => {
    expect(safeCallbackURL(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    ["/dashboard", "/settings"],
    "dashboard",
    "https://evil.com",
    "http://localhost:3000/settings",
    "//evil.com",
    "//evil.com/path",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/\t/evil.com",
  ])("rejects %j", (value) => {
    expect(safeCallbackURL(value as string)).toBe(SIGNED_IN_HOME);
  });

  it("leaves an encoded backslash encoded, so it stays a path on this site", () => {
    // Unlike a literal `/\evil.com` (rejected above), `%5C` isn't decoded
    // into a separator: the browser requests `/%5Cevil.com` from this origin.
    const result = safeCallbackURL("/%5Cevil.com");
    expect(new URL(result, "https://app.example").origin).toBe("https://app.example");
  });

  it("uses the given fallback", () => {
    expect(safeCallbackURL("https://evil.com", "/login")).toBe("/login");
  });
});
