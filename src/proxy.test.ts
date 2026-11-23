import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV } from "@/components/dashboard/dashboard-nav";
import { APP_URL } from "@/lib/env";
import { config, NON_COOKIE_API_PREFIXES, proxy } from "./proxy";

const DASHBOARD_DIR = join(__dirname, "app", "(dashboard)");
const API_DIR = join(__dirname, "app", "api");
const APP_ORIGIN = new URL(APP_URL).origin;

function apiRequest(path: string, method: string, origin?: string) {
  return new NextRequest(`${APP_ORIGIN}${path}`, {
    method,
    headers: { cookie: "better-auth.session_token=abc.def", ...(origin ? { origin } : {}) },
  });
}

describe("proxy", () => {
  it("sends a request without a session cookie to login, keeping the path", () => {
    const response = proxy(new NextRequest("http://localhost:3000/settings?tab=members"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackURL")).toBe("/settings?tab=members");
  });

  it("lets a request with a session cookie through", () => {
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: "better-auth.session_token=abc.def" },
    });

    const response = proxy(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("covers every page under app/(dashboard) and every dashboard nav entry", () => {
    const pages = readdirSync(DASHBOARD_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(DASHBOARD_DIR, entry.name, "page.tsx")))
      .map((entry) => `/${entry.name}/:path*`);
    const navTargets = DASHBOARD_NAV.map((item) => `${item.href}/:path*`);

    expect(pages.length).toBeGreaterThan(0);
    expect(config.matcher).toEqual(expect.arrayContaining([...pages, ...navTargets]));
  });
});

describe("proxy CSRF guard on API routes", () => {
  it("refuses a state-changing request from another origin", async () => {
    // A sibling subdomain is the same site, so SameSite=Lax would send the cookie.
    const response = proxy(apiRequest("/api/org", "DELETE", "https://evil.example.com"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Cross-origin request refused." });
  });

  it("refuses a state-changing request with no Origin header", () => {
    expect(proxy(apiRequest("/api/org/invites", "POST")).status).toBe(403);
  });

  it("lets a same-origin state-changing request through without redirecting", () => {
    const response = proxy(apiRequest("/api/org/invites", "POST", APP_ORIGIN));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets reads through from any origin", () => {
    const response = proxy(apiRequest("/api/org/export", "GET", "https://evil.example.com"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves routes that don't use the session cookie to their own checks", () => {
    for (const prefix of NON_COOKIE_API_PREFIXES) {
      expect(proxy(apiRequest(`${prefix}anything`, "POST")).headers.get("x-middleware-next"), prefix).toBe("1");
    }
  });

  it("covers every API route that changes state", () => {
    const mutating = (readdirSync(API_DIR, { recursive: true }) as string[])
      .filter((file) => file.endsWith("route.ts"))
      .filter((file) => /export (async )?function (POST|PUT|PATCH|DELETE)\b/.test(readFileSync(join(API_DIR, file), "utf8")))
      .map((file) => `/api/${file.replace(/(^|\/)route\.ts$/, "")}`);

    expect(mutating.length).toBeGreaterThan(0);
    expect(config.matcher).toContain("/api/:path*");
    for (const path of mutating.filter((p) => !NON_COOKIE_API_PREFIXES.some((prefix) => `${p}/`.startsWith(prefix)))) {
      expect(proxy(apiRequest(path, "POST", "https://evil.example.com")).status, path).toBe(403);
    }
  });
});
