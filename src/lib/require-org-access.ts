import { auth } from "@/lib/auth";
import { getCurrentOrgMembership, getMembershipForOrg } from "@/lib/current-org";
import type { Organization, OrganizationMember, OrgRole as Role } from "@/db/models";

export type OrgRole = Role;
type SessionUser = { id: string; email: string; name: string; [key: string]: unknown };

const ROLE_RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

function meetsMinRole(role: OrgRole, minRole: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export type OrgAccessDenialReason = "unauthenticated" | "no-membership" | "insufficient-role";

export type OrgAccessResult =
  | { ok: true; user: SessionUser; organization: Organization; membership: OrganizationMember }
  | { ok: false; reason: OrgAccessDenialReason };

export interface RequireOrgAccessOptions {
  /**
   * Minimum role the caller's own membership must satisfy. Defaults to
   * `"member"` (any active member is authorized) — pass `"admin"` for
   * owner/admin-gated actions (invite, change role, remove member).
   */
  minRole?: OrgRole;
  /**
   * The org to check the caller's membership against. Omit to use the
   * caller's own "current" org (this app has no org-switcher yet — see
   * `getCurrentOrgMembership` — so "current org" doubles as "the org the
   * caller is acting within" for every route today).
   *
   * If you DO pass this, it must already be a server-trusted id — e.g. the
   * `orgId` off a target row *this route itself already loaded* — never a
   * raw value taken straight from a request body/query string/route param.
   * `requireOrgAccess` only proves the caller is a member of *this specific
   * org*; it does not make it safe to let a client choose which org that
   * is. See `src/app/api/org/members/[memberId]/route.ts` for the
   * established pattern: load the target row first (by its own id, not by
   * org), then re-verify the caller against that row's own `orgId`.
   */
  orgId?: string;
}

/**
 * ORG-SCOPED-QUERY: the single required authorization gate for any route or
 * server-side query that reads or writes another org member's data. This is
 * Step 2.4's formalization of the building blocks `@/lib/current-org`
 * exposed in Step 2.3 (`getCurrentOrgMembership`/`getMembershipForOrg`) —
 * those are still the lower-level primitives this function is built on, but
 * route/page code should call THIS function, not them directly (enforced by
 * `eslint.config.mjs`'s `no-restricted-imports` rule under `src/app/**`).
 *
 * Two properties make this safe against the highest-damage bug class for a
 * boilerplate resold to many end-customers (cross-tenant data leakage,
 * per `docs/EXECUTION_BLUEPRINT.md`'s Security Checklist):
 *
 * 1. It re-derives the caller's identity from `headers` (a real session
 *    lookup against Better Auth) on every single call — never from a
 *    client-supplied user id.
 * 2. It re-checks `organization_members` against LIVE Postgres state on
 *    every single call — never from anything cached in the session/JWT.
 *    Better Auth's own session table carries no org/role data at all, so
 *    there is nothing to go stale in the session itself; the risk this
 *    guards against is an application bug that trusts a *previous* lookup
 *    instead of re-querying. Concretely: if a member's row in
 *    `organization_members` is deleted (removed from the org) or its role
 *    is downgraded, their very next request through this helper reflects
 *    that immediately, even though their session cookie is still perfectly
 *    valid and unchanged — no session revocation/invalidation is required
 *    or performed.
 *
 * Every org-scoped query should either go through this helper or carry an
 * explicit `// ORG-SCOPED-QUERY: exempt because ...` comment at the call
 * site explaining why not, plus a matching entry in `eslint.config.mjs`'s
 * org-scoped-query `ignores` list if it needs to import the lower-level
 * building blocks directly. Known, legitimate exemptions in this codebase:
 *   - `POST /api/org` (`src/app/api/org/route.ts`) — checks for the
 *     ABSENCE of any org membership (to decide whether org creation is
 *     allowed), not access to an existing one.
 *   - `POST /api/org/invites/[token]/accept` — authorized by invite-token
 *     possession + an email match, not by an existing membership; there is
 *     no membership to check yet, that's the entire point of the route.
 */
export async function requireOrgAccess(
  headers: Headers,
  options: RequireOrgAccessOptions = {},
): Promise<OrgAccessResult> {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return { ok: false, reason: "unauthenticated" };
  }

  const row = options.orgId
    ? await getMembershipForOrg(session.user.id, options.orgId)
    : await getCurrentOrgMembership(session.user.id);

  if (!row) {
    return { ok: false, reason: "no-membership" };
  }

  const minRole = options.minRole ?? "member";
  if (!meetsMinRole(row.membership.role, minRole)) {
    return { ok: false, reason: "insufficient-role" };
  }

  return { ok: true, user: session.user, organization: row.organization, membership: row.membership };
}

const DEFAULT_DENIAL_RESPONSES: Record<OrgAccessDenialReason, { status: number; message: string }> = {
  unauthenticated: { status: 401, message: "Not signed in." },
  "no-membership": { status: 404, message: "You don't belong to an organization." },
  "insufficient-role": { status: 403, message: "You don't have permission to do this." },
};

/**
 * Converts a denied `OrgAccessResult` into a `Response`, with optional
 * per-reason message overrides for routes that want more specific copy
 * (e.g. "Only owners and admins can invite members." instead of the
 * generic insufficient-role message). Status codes are NOT overridable —
 * they're the actual security-relevant part of the contract (e.g.
 * `no-membership` always 404, never 403, so this never confirms/denies
 * that a specific org exists to a caller who isn't in it).
 */
export function orgAccessErrorResponse(
  result: Extract<OrgAccessResult, { ok: false }>,
  messages: Partial<Record<OrgAccessDenialReason, string>> = {},
): Response {
  const fallback = DEFAULT_DENIAL_RESPONSES[result.reason];
  return Response.json({ error: messages[result.reason] ?? fallback.message }, { status: fallback.status });
}
