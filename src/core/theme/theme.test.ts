import { describe, expect, it } from "vitest";
import { parseThemeChoice, themeInitScript } from ".";

describe("parseThemeChoice", () => {
  it("keeps a forced theme", () => {
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
  });

  it("falls back to system for anything else", () => {
    for (const value of [null, undefined, "", "system", "Dark", "blue", 1]) {
      expect(parseThemeChoice(value)).toBe("system");
    }
  });
});

describe("themeInitScript", () => {
  function run(stored: string | null, { blocked = false } = {}) {
    const root = { dataset: {} as Record<string, string> };
    const localStorage = {
      getItem: () => {
        if (blocked) throw new Error("SecurityError");
        return stored;
      },
    };
    new Function("localStorage", "document", themeInitScript)(localStorage, { documentElement: root });
    return root.dataset.theme;
  }

  it("forces the stored theme", () => {
    expect(run("dark")).toBe("dark");
    expect(run("light")).toBe("light");
  });

  it("leaves the OS in charge otherwise, and never throws", () => {
    expect(run(null)).toBeUndefined();
    expect(run("<script>")).toBeUndefined();
    expect(run("dark", { blocked: true })).toBeUndefined();
  });
});
