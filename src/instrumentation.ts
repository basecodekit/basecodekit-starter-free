import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry. Off unless `SENTRY_DSN` is set, so dev and CI run
 * without it; every `Sentry.*` call is a no-op until `init` has run.
 *
 * Browser-side Sentry is deliberately not wired: it would need the CSP in
 * `next.config.ts` to allow Sentry's ingest host (or a tunnel route), and
 * nothing client-side needs alerting yet.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  // Same for siteConfig.brand: a bad color or logo URL stops the server.
  const { brand } = await import("@/core/brand");
  for (const warning of brand.warnings) console.warn(`[brand] ${warning}`);

  if (!process.env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Errors, alerts and cron check-ins only — no performance tracing.
    tracesSampleRate: 0,
    // SENTRY_DEBUG=true logs every envelope the SDK sends or drops.
    debug: process.env.SENTRY_DEBUG === "true",
  });
}

export const onRequestError = Sentry.captureRequestError;
