import { findUserSessionToken } from "@/db/repo";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/require-session";

const RATE_LIMIT = { windowMs: 60_000, max: 30 };

/**
 * Signs one of the caller's other browsers out. The session is looked up by
 * id AND the caller's user id, so someone else's session is
 * indistinguishable from a missing one (404). The current session is
 * refused: signing out is its own flow.
 *
 * 204 signed out · 400 it's this browser · 401 · 404 no such session · 429
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireSessionUser(request);
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!(await checkRateLimit(`account-sessions:${user.id}`, RATE_LIMIT.windowMs, RATE_LIMIT.max))) {
    return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const { sessionId } = await params;
  const token = await findUserSessionToken(sessionId, user.id);
  if (!token) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const current = await auth.api.getSession({ headers: request.headers });
  if (current?.session.id === sessionId) {
    return Response.json({ error: "This is the browser you're using. Sign out from the account menu." }, { status: 400 });
  }

  await auth.api.revokeSession({ headers: request.headers, body: { token } });
  return new Response(null, { status: 204 });
}
