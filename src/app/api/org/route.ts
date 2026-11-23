import { z } from "zod";
import { createOrganization, deleteOrganization } from "@/db/repo";
import { getCurrentOrgMembership } from "@/lib/current-org";
import { orgAccessErrorResponse, requireOrgAccess } from "@/lib/require-org-access";
import { parseJsonBody } from "@/lib/parse-body";
import { requireSessionUser } from "@/lib/require-session";
import { deleteObject } from "@/lib/storage";

const MAX_ORG_NAME_LENGTH = 200;
const NAME_ERROR = `Organization name is required and must be at most ${MAX_ORG_NAME_LENGTH} characters.`;
const CONFIRM_ERROR = "Type the organization's name exactly to confirm.";

const createBody = z.object({
  name: z.string({ error: NAME_ERROR }).trim().min(1, NAME_ERROR).max(MAX_ORG_NAME_LENGTH, NAME_ERROR),
});
const deleteBody = z.object({ confirmName: z.string({ error: CONFIRM_ERROR }).trim() });

/**
 * Creates an organization owned by the caller, plus the matching `owner`
 * membership row, in one transaction.
 *
 * Deliberately refuses if the caller already belongs to any org: this app
 * has no org-switcher UI yet, and "current org" (`getCurrentOrgMembership`)
 * is simplistically defined as the *first* org a user is a member of — a
 * second org created today would be an org this app could never surface as
 * current until a real switcher exists. "Create another org" (explicitly
 * mentioned as in-scope by the ticket) is deferred until that UI exists.
 *
 * ORG-SCOPED-QUERY: exempt from `requireOrgAccess` (Step 2.4) — that helper
 * authorizes access to an EXISTING org membership; this route does the
 * opposite, checking for the ABSENCE of any org membership to decide
 * whether org creation is allowed. There is no target org to scope a query
 * to yet. See `eslint.config.mjs`'s org-scoped-query `ignores` entry for
 * this file.
 */
export async function POST(request: Request) {
  const user = await requireSessionUser(request);
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const existing = await getCurrentOrgMembership(user.id);
  if (existing) {
    return Response.json(
      { error: "You already belong to an organization." },
      { status: 409 },
    );
  }

  const parsed = await parseJsonBody(request, createBody);
  if (!parsed.ok) return parsed.response;
  const { name } = parsed.data;

  const organization = await createOrganization({ name, ownerUserId: user.id });

  return Response.json({ organization }, { status: 201 });
}

/**
 * Deletes the caller's org and everything stored about it (GDPR erasure).
 * Owner only, and the body must repeat the org's name: `{ confirmName }`.
 * Members keep their user accounts; they just no longer belong to the org.
 *
 * 204 deleted · 400 name doesn't match · 403 not the owner
 */
export async function DELETE(request: Request) {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess.
  const access = await requireOrgAccess(request.headers, { minRole: "owner" });
  if (!access.ok) {
    return orgAccessErrorResponse(access, { "insufficient-role": "Only the organization owner can delete it." });
  }
  const { organization } = access;

  const parsed = await parseJsonBody(request, deleteBody);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.confirmName !== organization.name) {
    return Response.json({ error: CONFIRM_ERROR }, { status: 400 });
  }


  await deleteOrganization(organization.id);

  // After the row is gone: a failure here only leaves an unreferenced file.
  if (organization.logoKey) {
    try {
      await deleteObject(organization.logoKey);
    } catch (error) {
      console.error(`Could not delete stored object ${organization.logoKey}`, error);
    }
  }

  return new Response(null, { status: 204 });
}
