import { z } from "zod";
import { avatarKeyFromUrl } from "@/core/account/avatar-upload";
import { deleteAccount } from "@/core/account/deletion";
import { auth } from "@/lib/auth";
import { parseJsonBody } from "@/lib/parse-body";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/require-session";
import { deleteObject, isStorageConfigured } from "@/lib/storage";

const DELETE_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 };
const CONFIRM_PHRASE = "delete my account";
const CONFIRM_ERROR = `Type "${CONFIRM_PHRASE}" exactly to confirm.`;

const deleteBody = z.object({ confirm: z.string({ error: CONFIRM_ERROR }).trim() });

/** Removes a stored file, logging rather than failing if that errors:
 * the account is already gone, a leftover file is only unreferenced. */
async function discard(key: string) {
  try {
    await deleteObject(key);
  } catch (error) {
    console.error(`Could not delete stored object ${key}`, error);
  }
}

/**
 * Deletes the caller's own account (GDPR erasure). The body repeats the
 * phrase "delete my account": `{ confirm }`. When the caller is the only member
 * of the org they own, that org and its data go with it; when the org has
 * other members the account stays, and they must hand over ownership or
 * delete the org first. The caller is signed out in the same response.
 *
 * 204 deleted · 400 email doesn't match · 401 not signed in ·
 * 409 owns an org that still has members · 429 too many attempts
 */
export async function DELETE(request: Request) {
  const user = await requireSessionUser(request);
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!(await checkRateLimit(`account-delete:${user.id}`, DELETE_RATE_LIMIT.windowMs, DELETE_RATE_LIMIT.max))) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, deleteBody);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.confirm.toLowerCase() !== CONFIRM_PHRASE) {
    return Response.json({ error: CONFIRM_ERROR }, { status: 400 });
  }

  const result = await deleteAccount(user.id);
  if (!result.ok) {
    const blocked = `You own ${result.orgName}, which still has other members. Transfer its ownership or delete it first.`;
    const error = blocked;
    return Response.json({ error }, { status: 409 });
  }

  if (isStorageConfigured()) {
    if (result.deletedOrg?.logoKey) await discard(result.deletedOrg.logoKey);
    const avatarKey = avatarKeyFromUrl(user.image, user.id);
    if (avatarKey) await discard(avatarKey);
  }

  // The session row went with the user; this clears the browser's cookies.
  const headers = new Headers();
  try {
    const signedOut = await auth.api.signOut({ headers: request.headers, asResponse: true });
    for (const cookie of signedOut.headers.getSetCookie()) headers.append("set-cookie", cookie);
  } catch (error) {
    console.error("Could not clear the session cookies after deleting an account", error);
  }
  return new Response(null, { status: 204, headers });
}
