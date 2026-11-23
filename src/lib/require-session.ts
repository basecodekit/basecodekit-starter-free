import { auth } from "@/lib/auth";

/**
 * Shared by every custom (non-Better-Auth) API route in this app that needs
 * "who is calling" — reads the session straight off the incoming
 * `Request`'s own `headers` (a plain Web `Headers` instance), never
 * `next/headers`'s `headers()`. That keeps these routes callable directly in
 * Vitest the same way `src/app/api/auth/[...all]/*.test.ts` already calls
 * `route.ts`'s exported `GET`/`POST` with a hand-built `Request` — no
 * Next.js request-scope (`AsyncLocalStorage`) needs to be present, unlike
 * `next/headers`'s `headers()`, which throws outside one.
 */
export async function requireSessionUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
