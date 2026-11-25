import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertPooledDatabaseUrl, resolveAppUrl } from "./env";

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

describe("assertPooledDatabaseUrl", () => {
  const same = "postgresql://u:p@db.example.com:5432/app";
  const pooled = "postgresql://u:p@pooler.example.com:6543/app";

  it("refuses a serverless host running on the direct connection", () => {
    for (const host of ["VERCEL", "AWS_LAMBDA_FUNCTION_NAME", "NETLIFY"]) {
      expect(() => assertPooledDatabaseUrl(env({ [host]: "1", DATABASE_URL: same, DIRECT_URL: same }))).toThrow(
        /DATABASE_URL is the same as DIRECT_URL/,
      );
    }
  });

  it("accepts a serverless host on the pooled connection", () => {
    expect(() => assertPooledDatabaseUrl(env({ VERCEL: "1", DATABASE_URL: pooled, DIRECT_URL: same }))).not.toThrow();
  });

  it("lets a long-running server use one URL for both", () => {
    expect(() => assertPooledDatabaseUrl(env({ DATABASE_URL: same, DIRECT_URL: same }))).not.toThrow();
  });
});

describe("DIRECT_URL", () => {
  // Migration configs (drizzle.config.ts, prisma/schema.prisma,
  // kysely.config.ts) sit outside src/. Nothing the app runs may open it.
  it("is never read by the app's runtime code", () => {
    const src = join(__dirname, "..");
    const offenders = (readdirSync(src, { recursive: true }) as string[])
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== join("lib", "env.ts"))
      .filter((f) => readFileSync(join(src, f), "utf8").includes("DIRECT_URL"));
    expect(offenders).toEqual([]);
  });
});
