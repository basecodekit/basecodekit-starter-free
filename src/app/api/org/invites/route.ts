import { z } from "zod";
import { createInvite, findPendingInvite, findUserByEmail, isOrgMember, refreshInvite } from "@/db/repo";
import { APP_URL } from "@/lib/env";
import { parseJsonBody } from "@/lib/parse-body";
import { orgAccessErrorResponse, requireOrgAccess } from "@/lib/require-org-access";
import { sendOrgInviteEmail } from "@/lib/email";
import { orgLogoUrl } from "@/lib/storage";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_ERROR = "A valid email is required.";

const inviteBody = z.object({
  email: z.string({ error: EMAIL_ERROR }).trim().toLowerCase().regex(EMAIL_PATTERN, EMAIL_ERROR),
  // Deliberately never "owner" — ownership transfer is a distinct, unbuilt
  // flow (see Step 2.2's pipeline log entry).
  role: z
    .enum(["admin", "member"], { error: "Role must be 'admin' or 'member'." })
    .nullish()
    .transform((role) => role ?? "member"),
});

/**
 * Sends (or, for an existing unexpired pending invite to the same email,
 * refreshes) an org invite. Only `owner`/`admin` members of the caller's
 * *own* current org may call this — the target org is always the caller's
 * own current org (resolved server-side by `requireOrgAccess`, never a
 * client-supplied value), so there's no way to invite people into an org the
 * caller doesn't belong to.
 */
export async function POST(request: Request) {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess — see that function's
  // header comment for what it guarantees (live-DB re-check, no
  // client-supplied org id).
  const access = await requireOrgAccess(request.headers, { minRole: "admin" });
  if (!access.ok) {
    return orgAccessErrorResponse(access, { "insufficient-role": "Only owners and admins can invite members." });
  }
  const { user, organization: currentOrganization } = access;

  const parsed = await parseJsonBody(request, inviteBody);
  if (!parsed.ok) return parsed.response;
  const { email, role } = parsed.data;

  const existingUserWithEmail = await findUserByEmail(email);
  if (existingUserWithEmail && (await isOrgMember(currentOrganization.id, existingUserWithEmail.id))) {
    return Response.json({ error: "This person is already a member of your organization." }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_MS).toISOString();

  const pending = await findPendingInvite(currentOrganization.id, email);
  const invite = pending
    ? await refreshInvite(pending.id, { role, expiresAt })
    : await createInvite({
        orgId: currentOrganization.id,
        email,
        role,
        expiresAt,
        invitedByUserId: user.id,
      });

  await sendOrgInviteEmail({
    email,
    url: `${APP_URL}/invite/${invite.token}`,
    orgName: currentOrganization.name,
    orgLogoUrl: orgLogoUrl(currentOrganization),
    inviterName: user.name || user.email,
  });

  return Response.json(
    { invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt } },
    { status: 201 },
  );
}
