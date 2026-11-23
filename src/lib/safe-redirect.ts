/** Where a signed-in user lands when nothing asked for somewhere specific. */
export const SIGNED_IN_HOME = "/dashboard";

/**
 * Validates a post-sign-in `callbackURL` (from a query string, so attacker-
 * controllable). Only a same-origin path is allowed: `/invite/abc` passes;
 * `https://evil.com`, `//evil.com`, `/\evil.com` and `javascript:` don't —
 * anything else returns `fallback`, so a crafted login link can never send
 * someone off-site after they sign in.
 */
export function safeCallbackURL(value: string | string[] | null | undefined, fallback = SIGNED_IN_HOME): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  // Belt and braces: resolve against a dummy origin and require it to stay
  // there (catches encodings browsers normalize into another host).
  const base = "http://callback.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
