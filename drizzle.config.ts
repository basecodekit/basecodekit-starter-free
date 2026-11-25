import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for this app's *own* tables (organizations, RBAC, etc.
 * going forward) — deliberately scoped to `schema/org.ts` only, NOT
 * `schema/auth.ts`.
 *
 * Better Auth's tables (`user`, `session`, `account`, `verification`,
 * `passkey`, `twoFactor`) are created and migrated exclusively by Better
 * Auth's own CLI (`bunx auth@latest migrate`) — drizzle-kit's migration
 * journal has no idea those tables already exist, so if `schema/auth.ts`
 * were included here, `drizzle-kit generate` would emit `CREATE TABLE`
 * statements for tables that are already live (and owned by a different
 * migration tool), and a fresh-environment `drizzle-kit migrate` could race
 * Better Auth's own migration for who creates them first. `schema/auth.ts`
 * still exists and is still imported by `src/db/index.ts` for type-safe
 * querying/joins — it's just never a target of drizzle-kit's own
 * generate/migrate machinery. The files in `schema` below (every table file
 * that isn't Better Auth's) are the only things drizzle-kit is allowed to
 * manage migrations for.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/db/schema/org.ts",
  ],
  out: "./drizzle",
  // Migrations take the direct connection: a transaction-mode pooler (such as
  // Supabase's on port 6543) can't run them. Falls back to DATABASE_URL where
  // there is no pooler and both are the same database.
  dbCredentials: {
    url: (process.env.DIRECT_URL || process.env.DATABASE_URL) as string,
  },
});
