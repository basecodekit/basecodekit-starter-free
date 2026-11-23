import { pgTable, pgEnum, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

/**
 * This app's own schema (organizations + single-level RBAC membership).
 * Unlike `schema/auth.ts` (Better Auth's own tables, read-only from
 * drizzle-kit's perspective — see that file's header), THIS file is the one
 * `drizzle.config.ts`'s `schema` glob points at: `drizzle-kit generate`
 * diffs against it and `drizzle-kit migrate` applies the result. Hand
 * authored, not introspected.
 */

/**
 * A Postgres native enum, not a `text` column with a Drizzle-level union
 * type or a check constraint. This is the first enum in this app's own
 * schema (no prior convention to match — `schema/auth.ts` has none, since
 * it's an introspected mirror of Better Auth's own tables, which don't use
 * one either). Chose a native enum over `text` + check constraint because
 * role is the single value every org-scoping/RBAC security check in this
 * app will branch on (see the blueprint's Security Checklist: "every
 * org-scoped query enforces org_id server-side") — a `pgEnum` rejects an
 * invalid role value at the database layer itself (defense in depth even if
 * an app-layer bug lets a bad value through), and Drizzle infers the exact
 * `"owner" | "admin" | "member"` TS union from it automatically, so callers
 * get compile-time exhaustiveness checking on role comparisons for free.
 */
export const organizationRole = pgEnum("organization_role", ["owner", "admin", "member"]);

export const organizations = pgTable(
  "organizations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    /**
     * `onDelete: "restrict"` (Postgres default is functionally similar —
     * `NO ACTION` — but stated explicitly here so the intent is visible in
     * the schema, not implicit). Deliberately NOT `cascade` or `set null`:
     *   - `cascade` would silently destroy an entire organization (and, via
     *     `organization_members`' own cascade below, every member's
     *     membership row) as a side effect of deleting one user account —
     *     the single most surprising, highest-blast-radius outcome of the
     *     three options, for a boilerplate resold to many end-customers.
     *   - `set null` would require making this column nullable and leaves
     *     an ownerless organization behind — worse than blocking the
     *     delete, since nothing in the app today (no dashboard exists yet,
     *     per Step 2.3) can act on an ownerless org or reassign it.
     *   - `restrict` (chosen) makes deleting an org's owner a hard error
     *     until the caller explicitly transfers ownership or deletes the
     *     org first. That's the safest default in the absence of an
     *     ownership-transfer flow — Step 2.3+ should add one before this
     *     restriction becomes a real support-ticket source.
     */
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    /**
     * Object key of the org's uploaded logo in the storage bucket
     * (`src/lib/storage.ts`), set only after the upload's bytes were checked
     * server-side. Null: the org shows `siteConfig.brand`'s logo instead.
     */
    logoKey: text("logo_key"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("organizations_owner_user_id_idx").on(table.ownerUserId)],
);

/**
 * Pending email invitations to an organization. Split out from
 * `organization_members` (rather than, say, pre-creating a membership row
 * with a "pending" flag) because an invitee may not have a `user` row yet —
 * there's nothing to point `organization_members.user_id` at until they sign
 * up. `token` is the single-use, unguessable credential emailed to the
 * invitee (a URL of the form `/invite/{token}`); possession of it is what
 * authorizes accepting the invite, the same trust model as Better Auth's own
 * magic-link/verification tokens elsewhere in this app.
 */
export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organizationRole("role").notNull().default("member"),
    token: text("token")
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    // Who sent the invite — an audit trail, not an access-control input.
    // `cascade`: if the inviter's own account is later deleted, the invite
    // row (and its audit value) has no meaningful owner left to point to;
    // same reasoning as `organization_members.user_id`'s cascade below. This
    // does mean deleting an inviter's account also deletes invites they sent
    // that haven't been accepted yet — an accepted edge case for now, flagged
    // in the pipeline log rather than solved here.
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    // Null while pending. Set (not deleted) on acceptance so accepted invites
    // remain a record of who invited whom, when, and when it was accepted.
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    // "does this org already have a pending invite for this email" lookups.
    index("organization_invites_org_id_email_idx").on(table.orgId, table.email),
  ],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // A deleted org should drop its memberships — there's nothing left to
    // scope them to, and no dashboard-side "restore" concept exists.
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Unlike `organizations.owner_user_id` above, a plain membership row is
    // safe to cascade-delete when the user account itself is deleted — it
    // carries no org-level state worth preserving, just "this user belongs
    // to this org with this role." If the deleted user happens to be the
    // org's owner, `organizations.owner_user_id`'s `restrict` FK already
    // blocks that user delete from succeeding in the first place, so this
    // cascade only ever fires for non-owner members in practice.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: organizationRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    // A user can only hold one membership row (one role) per org — prevents
    // duplicate/conflicting-role rows for the same (org, user) pair.
    uniqueIndex("organization_members_org_id_user_id_key").on(table.orgId, table.userId),
    // `org_id` is already indexed implicitly by the unique index above
    // (it's the leading column), but `user_id` alone is not — add it
    // explicitly for "which orgs is this user a member of" lookups, which
    // don't lead with `org_id`.
    index("organization_members_user_id_idx").on(table.userId),
  ],
);
