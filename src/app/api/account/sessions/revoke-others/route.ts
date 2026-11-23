import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/require-session";

const RATE_LIMIT = { windowMs: 60_000, max: 30 };

/**
 * Signs the caller out everywhere except the browser making the request.
 * Better Auth only touches the caller's own sessions.
 *
 * 204 done · 401 · 429
 */
export async function POST(request: Request) {
  const user = await requireSessionUser(request);
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!checkRateLimit(`account-sessions:${user.id}`, RATE_LIMIT.windowMs, RATE_LIMIT.max)) {
    return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  await auth.api.revokeOtherSessions({ headers: request.headers });
  return new Response(null, { status: 204 });
}
