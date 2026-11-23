import { getCurrentOrgMembership, getMembershipForOrg } from "@/db/repo";

// The queries live in `@/db/repo`; this module keeps its public names.
export { getCurrentOrgMembership, getMembershipForOrg };

/**
 * "Current org" simplification (Step 2.3): there's no org-switcher UI yet
 * (and no session-side "active org" concept — Better Auth's own session
 * table carries none), so a signed-in user's current org is simply the
 * first organization they became a member of, ordered by
 * `organization_members.created_at` ascending. This is a deliberate,
 * stated simplification, not an oversight — see the pipeline log entry for
 * Step 2.3. It also means org creation is only offered to a user with zero
 * memberships today (see `POST /api/org`): creating a second org for a user
 * who already has one would create an org this simplification could never
 * surface as "current" until a real switcher exists.
 */
/**
 * Only `owner`/`admin` may manage members (invite, change roles, remove).
 * `requireOrgAccess()` (`@/lib/require-org-access`) is Step 2.4's shared
 * gate for routes/pages, built on top of this and the two functions above —
 * this predicate is still exported as a standalone building block (e.g. for
 * a future client-visible permission check that has no DB access of its
 * own), but any route or page performing an org-scoped *query* should go
 * through `requireOrgAccess()`, not call this directly against a
 * separately-fetched membership row.
 */
export function canManageMembers(role: "owner" | "admin" | "member"): boolean {
  return role === "owner" || role === "admin";
}
