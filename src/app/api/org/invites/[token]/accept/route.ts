import { acceptInvite, findInviteByToken, findOrganizationById } from "@/db/repo";
import { requireSessionUser } from "@/lib/require-session";

/**
 * Accepts a pending invite. The invite's `org_id`/`role` (both read from the
 * token row itself, never from client input) are the entire authorization
 * for who gets added where — the same trust model as any other
 * possession-of-a-token flow in this app (Better Auth's own magic
 * link/verification tokens). The one extra check on top of "is this token
 * valid" is that the signed-in caller's own email matches the invited
 * email, so a different already-signed-in user can't consume someone else's
 * invite link.
 *
 * ORG-SCOPED-QUERY: exempt from `requireOrgAccess` (Step 2.4) — that helper
 * authorizes a caller who is ALREADY a member of the org in question; this
 * route is the mechanism by which a caller BECOMES a member, so there is no
 * existing membership to check going in. Authorization here is entirely
 * token-possession + email-match, per the paragraph above, which is a
 * legitimately different model, not a gap in the org-scoped-query
 * discipline. (This route doesn't import `@/lib/current-org`'s building
 * blocks either, so it isn't flagged by `eslint.config.mjs`'s
 * `no-restricted-imports` rule in the first place — this comment documents
 * the reasoning per the Step 2.4 ticket's explicit ask to state it, not
 * because the rule would otherwise catch it.)
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await requireSessionUser(request);
  if (!user) {
    return Response.json({ error: "Sign in first to accept this invite." }, { status: 401 });
  }

  const { token } = await params;
  const invite = await findInviteByToken(token);

  if (!invite) {
    return Response.json({ error: "This invite link is invalid." }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return Response.json({ error: "This invite has already been accepted." }, { status: 410 });
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return Response.json({ error: "This invite has expired." }, { status: 410 });
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json(
      { error: `This invite was sent to ${invite.email}. Sign in with that email to accept it.` },
      { status: 403 },
    );
  }

  const organization = await findOrganizationById(invite.orgId);
  if (!organization) {
    // The org was deleted after the invite was sent but before it was
    // accepted — the FK's `cascade` would already have deleted this invite
    // row too in that case, so this branch is unreachable in practice, but
    // kept as a defensive guard against relying on that indirectly.
    return Response.json({ error: "This organization no longer exists." }, { status: 404 });
  }

  // Already a member (e.g. re-clicking an old link after being invited
  // twice): their existing role is left untouched rather than letting a
  // resent invite silently re-grant a role; the invite is still marked accepted.
  await acceptInvite(invite, user.id);

  return Response.json({ organizationId: invite.orgId, organizationName: organization.name });
}
