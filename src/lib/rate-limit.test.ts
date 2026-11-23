import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit and blocks the next one", () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(checkRateLimit(key, 60_000, 3)).toBe(true);
    expect(checkRateLimit(key, 60_000, 3)).toBe(true);
    expect(checkRateLimit(key, 60_000, 3)).toBe(true);
    expect(checkRateLimit(key, 60_000, 3)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;

    expect(checkRateLimit(keyA, 60_000, 1)).toBe(true);
    expect(checkRateLimit(keyA, 60_000, 1)).toBe(false);
    expect(checkRateLimit(keyB, 60_000, 1)).toBe(true);
  });

  it("resets once the window elapses", async () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(checkRateLimit(key, 50, 1)).toBe(true);
    expect(checkRateLimit(key, 50, 1)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(checkRateLimit(key, 50, 1)).toBe(true);
  });
});
