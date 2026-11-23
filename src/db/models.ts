/**
 * The shapes the app's data-access layer (`@/db/repo`) hands to routes and
 * pages. They are plain types, not an ORM's inferred row types, so the
 * Drizzle reference and the Prisma and Kysely templates can each implement
 * `repo.ts` against the same contract. Timestamps are ISO strings.
 */

export type OrgRole = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  logoKey: string | null;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
}

export interface OrganizationInvite {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  token: string;
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface MembershipWithOrg {
  membership: OrganizationMember;
  organization: Organization;
}

/** A member joined with their user record, for the settings member list. */
export interface MemberListItem {
  id: string;
  role: OrgRole;
  createdAt: string;
  userId: string;
  name: string;
  email: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
}
