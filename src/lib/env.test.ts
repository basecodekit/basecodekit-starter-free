import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "./env";

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

describe("resolveAppUrl", () => {
  it("uses BETTER_AUTH_URL when set", () => {
    expect(resolveAppUrl(env({ NODE_ENV: "production", BETTER_AUTH_URL: "https://yourapp.com" }))).toBe(
      "https://yourapp.com",
    );
  });

  it("falls back to local dev outside production", () => {
    expect(resolveAppUrl(env({ NODE_ENV: "development" }))).toBe("http://localhost:3355");
    expect(resolveAppUrl(env({ NODE_ENV: "test" }))).toBe("http://localhost:3355");
  });

  it("refuses to run in production without it, empty included", () => {
    expect(() => resolveAppUrl(env({ NODE_ENV: "production" }))).toThrow(/BETTER_AUTH_URL is not set/);
    expect(() => resolveAppUrl(env({ NODE_ENV: "production", BETTER_AUTH_URL: "" }))).toThrow(/BETTER_AUTH_URL/);
  });

  it("lets a production build through, since the variable may only exist at run time", () => {
    expect(resolveAppUrl(env({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }))).toBe(
      "http://localhost:3355",
    );
  });
});
