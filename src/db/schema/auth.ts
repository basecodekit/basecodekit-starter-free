import { pgTable, index, foreignKey, unique, text, timestamp, integer, bigint, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Better Auth owns these tables. They are created and migrated exclusively
 * by Better Auth's own CLI (`bunx auth@latest migrate`) — never by
 * `drizzle-kit generate`/`migrate`, and never hand-rolled. This file exists
 * only so the rest of the app can query/join against them type-safely
 * through Drizzle.
 *
 * Generated via `bunx drizzle-kit introspect` against the live local
 * Postgres instance (not hand-written) so it's guaranteed to match the
 * actual table structure Better Auth's CLI produced, rather than a
 * best-effort transcription of Better Auth's docs. Verified independently
 * against `psql \d` output for every table before committing. If you ever
 * run `bunx auth@latest migrate` again (e.g. a Better Auth upgrade adds a
 * column), re-run introspect and diff this file — don't hand-edit it to
 * "guess" the new shape.
 */

export const user = pgTable("user", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull(),
  emailVerified: boolean().notNull(),
  image: text(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  // Added by the `two-factor` plugin's migration (Step 1.5), not part of
  // Better Auth's base `user` table.
  twoFactorEnabled: boolean().default(false),
}, (table) => [
  unique("user_email_key").on(table.email),
]);

export const session = pgTable("session", {
  id: text().primaryKey().notNull(),
  expiresAt: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  token: text().notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  ipAddress: text(),
  userAgent: text(),
  userId: text().notNull(),
}, (table) => [
  index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: "session_userId_fkey",
  }).onDelete("cascade"),
  unique("session_token_key").on(table.token),
]);

export const account = pgTable("account", {
  id: text().primaryKey().notNull(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text().notNull(),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true, mode: "string" }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: "string" }),
  scope: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "string" }).notNull(),
}, (table) => [
  index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: "account_userId_fkey",
  }).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

// Added by the `@better-auth/passkey` plugin's migration (Step 1.4).
export const passkey = pgTable("passkey", {
  id: text().primaryKey().notNull(),
  name: text(),
  publicKey: text().notNull(),
  userId: text().notNull(),
  credentialID: text().notNull(),
  counter: integer().notNull(),
  deviceType: text().notNull(),
  backedUp: boolean().notNull(),
  transports: text(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }),
  aaguid: text(),
}, (table) => [
  index("passkey_credentialID_idx").using("btree", table.credentialID.asc().nullsLast().op("text_ops")),
  index("passkey_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: "passkey_userId_fkey",
  }).onDelete("cascade"),
]);

// Added by the `two-factor` plugin's migration (Step 1.5). Note the table
// name is mixed-case in Postgres (`"twoFactor"`, quoted) — Drizzle handles
// the quoting for us via the string passed to `pgTable()`.
export const twoFactor = pgTable("twoFactor", {
  id: text().primaryKey().notNull(),
  secret: text().notNull(),
  backupCodes: text().notNull(),
  userId: text().notNull(),
  verified: boolean(),
  failedVerificationCount: integer(),
  lockedUntil: timestamp({ withTimezone: true, mode: "string" }),
}, (table) => [
  index("twoFactor_secret_idx").using("btree", table.secret.asc().nullsLast().op("text_ops")),
  index("twoFactor_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: "twoFactor_userId_fkey",
  }).onDelete("cascade"),
]);

// Added when `rateLimit.storage` became "database" in `src/lib/auth.ts`:
// Better Auth's rate-limit counters, shared by every server instance.
export const rateLimit = pgTable("rateLimit", {
  id: text().primaryKey().notNull(),
  key: text().notNull(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
}, (table) => [
  unique("rateLimit_key_key").on(table.key),
]);
