import { z } from "zod";
import { deleteMember, findMemberById, updateMemberRole } from "@/db/repo";
import type { OrganizationMember } from "@/db/models";
import { parseJsonBody } from "@/lib/parse-body";
import { type OrgAccessResult, orgAccessErrorResponse, requireOrgAccess } from "@/lib/require-org-access";

// Never "owner" — ownership transfer is a distinct, unbuilt flow (see Step
// 2.2's pipeline log entry).
const roleBody = z.object({ role: z.enum(["admin", "member"], { error: "Role must be 'admin' or 'member'." }) });

const INSUFFICIENT_ROLE_MESSAGE = "Only owners and admins can manage members.";

/**
 * ORG-SCOPED-QUERY: gates the caller (must be an owner/admin of THEIR OWN
 * current org, verified live against `organization_members` by
 * `requireOrgAccess`) and then loads the *target* membership row — but only
 * if that row actually belongs to the caller's own org. A `memberId`
 * belonging to a different org is treated identically to a non-existent one
 * (404, not 403) so this endpoint never confirms or denies the existence of
 * another org's membership rows to a caller who isn't in that org — the
 * exact cross-tenant leakage class the blueprint's Security Checklist calls
 * out as the costliest bug class here.
 */
async function loadAuthorizedTarget(
  headers: Headers,
  memberId: string,
): Promise<
  | { error: Response }
  | { access: Extract<OrgAccessResult, { ok: true }>; target: OrganizationMember }
> {
  const access = await requireOrgAccess(headers, { minRole: "admin" });
  if (!access.ok) {
    return { error: orgAccessErrorResponse(access, { "insufficient-role": INSUFFICIENT_ROLE_MESSAGE }) } as const;
  }

  const target = await findMemberById(memberId);

  // The target row's own `orgId` is the only thing trusted here — never the
  // `memberId` route param alone, and never a client-supplied org id.
  if (!target || target.orgId !== access.organization.id) {
    return { error: Response.json({ error: "Member not found." }, { status: 404 }) } as const;
  }

  return { access, target } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
): Promise<Response> {
  const { memberId } = await params;
  const authorized = await loadAuthorizedTarget(request.headers, memberId);
  if ("error" in authorized) return authorized.error;
  const { target } = authorized;

  if (target.role === "owner") {
    return Response.json(
      { error: "The organization owner's role can't be changed here." },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBody(request, roleBody);
  if (!parsed.ok) return parsed.response;

  const updated = await updateMemberRole(memberId, parsed.data.role);

  return Response.json({ member: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
): Promise<Response> {
  const { memberId } = await params;
  const authorized = await loadAuthorizedTarget(request.headers, memberId);
  if ("error" in authorized) return authorized.error;
  const { target } = authorized;

  if (target.role === "owner") {
    return Response.json({ error: "The organization owner can't be removed." }, { status: 403 });
  }

  await deleteMember(memberId);

  return new Response(null, { status: 204 });
}
