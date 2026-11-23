import * as Sentry from "@sentry/nextjs";

/**
 * Raises something an operator must look at — a Sentry issue when
 * `SENTRY_DSN` is configured (see `src/instrumentation.ts`), and always a log
 * line, so it's never lost when Sentry isn't set up.
 *
 * Keep `message` constant per kind of problem (put ids in `extra`) so Sentry
 * groups occurrences into one issue instead of one issue per org.
 */
export function reportAlert(
  message: string,
  extra: Record<string, unknown>,
  level: "warning" | "error" = "error",
): void {
  (level === "error" ? console.error : console.warn)(`[alert] ${message}`, extra);
  Sentry.captureMessage(message, { level, extra });
}
