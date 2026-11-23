import { and, asc, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  MemberListItem,
  MembershipWithOrg,
  Organization,
  OrganizationInvite,
  OrganizationMember,
  OrgRole,
  UserRecord,
} from "@/db/models";

/**
 * The app's data access for users, organizations, members and invites: the
 * Drizzle implementation. Routes and pages call these functions rather than
 * the ORM, so the Prisma and Kysely templates (`packages/cli/templates/*`)
 * only have to provide their own `repo.ts` with the same exports. Anything
 * that changes here must change in both templates.
 *
 * Authorization is NOT in this file: callers go through `requireOrgAccess`
 * (`@/lib/require-org-access`) and pass server-trusted ids.
 */

const first = <T>(rows: T[]): T | null => rows[0] ?? null;

export async function getCurrentOrgMembership(userId: string): Promise<MembershipWithOrg | null> {
  const [row] = await db
    .select({
      membership: schema.organizationMembers,
      organization: schema.organizations,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizationMembers.orgId, schema.organizations.id))
    .where(eq(schema.organizationMembers.userId, userId))
    .orderBy(asc(schema.organizationMembers.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getMembershipForOrg(userId: string, orgId: string): Promise<MembershipWithOrg | null> {
  const [row] = await db
    .select({
      membership: schema.organizationMembers,
      organization: schema.organizations,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizationMembers.orgId, schema.organizations.id))
    .where(and(eq(schema.organizationMembers.userId, userId), eq(schema.organizationMembers.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/** Creates the org and its `owner` membership in one transaction. */
export async function createOrganization(input: { name: string; ownerUserId: string }): Promise<Organization> {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(schema.organizations)
      .values({ name: input.name, ownerUserId: input.ownerUserId })
      .returning();
    await tx.insert(schema.organizationMembers).values({
      orgId: org.id,
      userId: input.ownerUserId,
      role: "owner",
    });
    return org;
  });
}

export async function findOrganizationById(id: string): Promise<Organization | null> {
  return first(await db.select().from(schema.organizations).where(eq(schema.organizations.id, id)).limit(1));
}

export async function findOrganizationByOwner(ownerUserId: string): Promise<Organization | null> {
  return first(
    await db.select().from(schema.organizations).where(eq(schema.organizations.ownerUserId, ownerUserId)).limit(1),
  );
}

/** Used by the dev seed, which creates the org and its membership separately. */
export async function insertOrganization(input: { name: string; ownerUserId: string }): Promise<Organization> {
  const [org] = await db.insert(schema.organizations).values(input).returning();
  return org;
}

export async function setOrganizationLogoKey(orgId: string, logoKey: string | null): Promise<void> {
  await db.update(schema.organizations).set({ logoKey }).where(eq(schema.organizations.id, orgId));
}

/** Deletes the org; its members, invites and every other org-owned row go
 * with it (their foreign keys cascade). */
export async function deleteOrganization(orgId: string): Promise<void> {
  await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
}

export async function findMemberById(id: string): Promise<OrganizationMember | null> {
  return first(
    await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.id, id)).limit(1),
  );
}

export async function findAnyMemberOfOrg(orgId: string): Promise<OrganizationMember | null> {
  return first(
    await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.orgId, orgId)).limit(1),
  );
}

export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.organizationMembers.id })
    .from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.orgId, orgId), eq(schema.organizationMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function addMember(input: { orgId: string; userId: string; role: OrgRole }): Promise<OrganizationMember> {
  const [member] = await db.insert(schema.organizationMembers).values(input).returning();
  return member;
}

export async function updateMemberRole(id: string, role: OrgRole): Promise<OrganizationMember> {
  const [member] = await db
    .update(schema.organizationMembers)
    .set({ role })
    .where(eq(schema.organizationMembers.id, id))
    .returning();
  return member;
}

export async function deleteMember(id: string): Promise<void> {
  await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.id, id));
}

export async function countMembers(orgId: string): Promise<number> {
  const [row] = await db
    .select({ members: count() })
    .from(schema.organizationMembers)
    .where(eq(schema.organizationMembers.orgId, orgId));
  return row.members;
}

/** Members with their user record, oldest first. */
export async function listMembers(orgId: string): Promise<MemberListItem[]> {
  return db
    .select({
      id: schema.organizationMembers.id,
      role: schema.organizationMembers.role,
      createdAt: schema.organizationMembers.createdAt,
      userId: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.user, eq(schema.organizationMembers.userId, schema.user.id))
    .where(eq(schema.organizationMembers.orgId, orgId))
    .orderBy(asc(schema.organizationMembers.createdAt));
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const [row] = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  return row ?? null;
}

export async function findInviteByToken(token: string): Promise<OrganizationInvite | null> {
  return first(
    await db.select().from(schema.organizationInvites).where(eq(schema.organizationInvites.token, token)).limit(1),
  );
}

export async function findInviteById(id: string): Promise<OrganizationInvite | null> {
  return first(
    await db.select().from(schema.organizationInvites).where(eq(schema.organizationInvites.id, id)).limit(1),
  );
}

/** Every invite the org has sent, pending or accepted, oldest first. */
export async function listInvites(orgId: string): Promise<OrganizationInvite[]> {
  return db
    .select()
    .from(schema.organizationInvites)
    .where(eq(schema.organizationInvites.orgId, orgId))
    .orderBy(asc(schema.organizationInvites.createdAt));
}

/** The org's not-yet-accepted invite for this email, if any. */
export async function findPendingInvite(orgId: string, email: string): Promise<OrganizationInvite | null> {
  return first(
    await db
      .select()
      .from(schema.organizationInvites)
      .where(
        and(
          eq(schema.organizationInvites.orgId, orgId),
          eq(schema.organizationInvites.email, email),
          isNull(schema.organizationInvites.acceptedAt),
        ),
      )
      .limit(1),
  );
}

/** Re-sends a pending invite: new role, new expiry, and a fresh token. */
export async function refreshInvite(
  id: string,
  input: { role: OrgRole; expiresAt: string },
): Promise<OrganizationInvite> {
  const [invite] = await db
    .update(schema.organizationInvites)
    .set({ role: input.role, expiresAt: input.expiresAt, token: crypto.randomUUID() })
    .where(eq(schema.organizationInvites.id, id))
    .returning();
  return invite;
}

export async function createInvite(input: {
  orgId: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  invitedByUserId: string;
}): Promise<OrganizationInvite> {
  const [invite] = await db.insert(schema.organizationInvites).values(input).returning();
  return invite;
}

/**
 * Adds the user to the invite's org and marks the invite accepted, together.
 * A user who is already a member keeps their existing role.
 */
export async function acceptInvite(invite: OrganizationInvite, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.organizationMembers)
      .values({ orgId: invite.orgId, userId, role: invite.role })
      .onConflictDoNothing({
        target: [schema.organizationMembers.orgId, schema.organizationMembers.userId],
      });
    await tx
      .update(schema.organizationInvites)
      .set({ acceptedAt: new Date().toISOString() })
      .where(eq(schema.organizationInvites.id, invite.id));
  });
}

export async function setUserImage(userId: string, image: string | null): Promise<void> {
  await db.update(schema.user).set({ image, updatedAt: new Date().toISOString() }).where(eq(schema.user.id, userId));
}

/** The token of one of the user's sessions; someone else's session reads as missing. */
export async function findUserSessionToken(sessionId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: schema.session.token })
    .from(schema.session)
    .where(and(eq(schema.session.id, sessionId), eq(schema.session.userId, userId)))
    .limit(1);
  return row?.token ?? null;
}

export type DeleteUserResult =
  | { ok: true; deletedOrg: Organization | null }
  | { ok: false; reason: "org-has-members" | "org-not-deletable"; org: Organization };

/**
 * Deletes the user, and the org they own when they are its only member, in
 * one transaction. The org row is locked while its members are counted, so
 * nobody can join between the check and the delete (a join takes a share
 * lock on the org through its foreign key). `mayDeleteOrg` lets the caller
 * still refuse a sole-member org for its own reasons.
 *
 * The org goes first: its owner foreign key restricts deleting the user.
 * The user row's own foreign keys do the rest (sessions, accounts, passkeys,
 * two-factor secrets and memberships cascade). Other orgs are untouched.
 */
export async function deleteUserWithSoleOwnedOrg(
  userId: string,
  mayDeleteOrg: (org: Organization) => Promise<boolean> = async () => true,
): Promise<DeleteUserResult> {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.ownerUserId, userId))
      .for("update")
      .limit(1);

    if (owned) {
      const [{ members }] = await tx
        .select({ members: count() })
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.orgId, owned.id));
      if (members > 1) return { ok: false, reason: "org-has-members", org: owned } as const;
      if (!(await mayDeleteOrg(owned))) return { ok: false, reason: "org-not-deletable", org: owned } as const;
      await tx.delete(schema.organizations).where(eq(schema.organizations.id, owned.id));
    }

    await tx.delete(schema.user).where(eq(schema.user.id, userId));
    return { ok: true, deletedOrg: owned ?? null } as const;
  });
}
