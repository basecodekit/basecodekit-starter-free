import { listInvites, listMembers } from "@/db/repo";
import { orgAccessErrorResponse, requireOrgAccess } from "@/lib/require-org-access";
import { orgLogoUrl } from "@/lib/storage";

/**
 * Everything this app stores about the caller's org, as a JSON download:
 * the owner's copy of their data (GDPR access and portability).
 *
 * Owner only. Invite tokens are left out: an export is a file that gets
 * passed around, and a token would let anyone holding it join the org.
 */
export async function GET(request: Request) {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess.
  const access = await requireOrgAccess(request.headers, { minRole: "owner" });
  if (!access.ok) {
    return orgAccessErrorResponse(access, { "insufficient-role": "Only the organization owner can export its data." });
  }
  const { organization } = access;

  const [members, invites] = await Promise.all([listMembers(organization.id), listInvites(organization.id)]);

  const data = {
    exportedAt: new Date().toISOString(),
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: orgLogoUrl(organization),
      createdAt: organization.createdAt,
    },
    members: members.map((member) => ({
      name: member.name,
      email: member.email,
      role: member.role,
      joinedAt: member.createdAt,
    })),
    invites: invites.map((invite) => ({
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
    })),
  };

  const date = data.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="organization-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
