import { describe, expect, it } from "vitest";
import { authPool } from "./auth-pool";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit and blocks the next one", async () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(await checkRateLimit(key, 60_000, 3)).toBe(true);
    expect(await checkRateLimit(key, 60_000, 3)).toBe(true);
    expect(await checkRateLimit(key, 60_000, 3)).toBe(true);
    expect(await checkRateLimit(key, 60_000, 3)).toBe(false);
  });

  it("tracks separate keys independently", async () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;

    expect(await checkRateLimit(keyA, 60_000, 1)).toBe(true);
    expect(await checkRateLimit(keyA, 60_000, 1)).toBe(false);
    expect(await checkRateLimit(keyB, 60_000, 1)).toBe(true);
  });

  it("resets once the window elapses", async () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(await checkRateLimit(key, 50, 1)).toBe(true);
    expect(await checkRateLimit(key, 50, 1)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(await checkRateLimit(key, 50, 1)).toBe(true);
  });

  it("lets exactly the limit through when requests arrive at once", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(key, 60_000, 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("keeps its counters in the shared table, out of Better Auth's keys", async () => {
    const key = `test:${crypto.randomUUID()}`;
    await checkRateLimit(key, 60_000, 5);
    const { rows } = await authPool.query(`SELECT count FROM "rateLimit" WHERE key = $1`, [`app:${key}`]);
    expect(rows).toEqual([{ count: 1 }]);
  });
});
