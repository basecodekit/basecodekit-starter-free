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

/**
 * `DATABASE_URL` is the pooled connection the app runs on; `DIRECT_URL` is
 * the unpooled one, for migrations only. On a serverless host every
 * invocation opens its own connections, so running on the direct one
 * exhausts Postgres' connection limit under real traffic ("too many
 * connections"). Refuses to start there when the two are the same.
 * Long-running servers (Docker, a VPS) may use one database URL for both.
 */
export function assertPooledDatabaseUrl(env: NodeJS.ProcessEnv): void {
  const serverless = Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY);
  if (serverless && env.DIRECT_URL && env.DATABASE_URL === env.DIRECT_URL) {
    throw new Error(
      "DATABASE_URL is the same as DIRECT_URL on a serverless host. Set DATABASE_URL to your database's pooled " +
        "connection string (Supabase: the pooler on port 6543) and keep DIRECT_URL for migrations.",
    );
  }
}
