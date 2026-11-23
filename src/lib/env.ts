/**
 * Single source of truth for this app's own base URL. Reads the same
 * `BETTER_AUTH_URL` env var Better Auth itself falls back to internally when
 * no explicit `baseURL` is passed to `betterAuth()` (see
 * `better-auth/dist/utils/url.mjs`) — everything that needs to know where
 * this app is running (auth config, Playwright, test fixtures) should import
 * `APP_URL` from here instead of hardcoding a port.
 */
export const APP_URL = resolveAppUrl(process.env);

/**
 * Outside production, unset means local dev on :3355. A production server
 * refuses to start without it: the fallback would bind passkeys to
 * `localhost`, point every emailed link there, and fail the API's origin
 * check on every write. `next build` is exempt, since a build environment
 * (a Docker image, say) often gets its variables only at run time.
 */
export function resolveAppUrl(env: NodeJS.ProcessEnv): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("BETTER_AUTH_URL is not set. Set it to this deployment's public origin, e.g. https://yourapp.com.");
  }
  return "http://localhost:3355";
}
