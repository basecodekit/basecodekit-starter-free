import "dotenv/config";
import { defineConfig } from "@playwright/test";
import { APP_URL } from "@/lib/env";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // The dev server compiles each route on first hit; with many parallel
  // workers those compiles pile up past the timeouts. Two workers matches
  // CI's runner and passes reliably.
  workers: 2,
  // Turbopack compiles routes on demand in dev mode, so the first hit to a
  // given route can be noticeably slower than the default 5s assertion
  // timeout — bump it rather than let that show up as flakiness.
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: APP_URL,
  },
  webServer: {
    command: "bun run dev",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
