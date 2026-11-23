import "dotenv/config";
import { auth } from "@/lib/auth";
import {
  addMember,
  findAnyMemberOfOrg,
  findOrganizationByOwner,
  findUserByEmail,
  insertOrganization,
} from "@/db/repo";

/**
 * Local dev seed script: one owner user + one org they own + the matching
 * `owner` membership row. No seeding convention existed anywhere else in
 * this repo before this ticket (checked: no `seed`/`db:seed` reference
 * anywhere in the tree) — this establishes it. Run via `npm run db:seed` (or your package manager)
 * (see `package.json`).
 *
 * Idempotent: safe to run multiple times against the same database without
 * creating duplicate users/orgs/memberships.
 */

const SEED_OWNER_EMAIL = "owner@example.com";
const SEED_OWNER_PASSWORD = "seed-owner-password-1!";
const SEED_OWNER_NAME = "Seed Owner";
const SEED_ORG_NAME = "Acme Test Org";

/**
 * Creates a REAL Better Auth user (via `auth.api.signUpEmail`), not a raw
 * `INSERT INTO "user"`. This matters: a raw row in Better Auth's `user`
 * table has no matching `account` row holding a real password hash, so it
 * could never actually sign in — reconstructing Better Auth's own password
 * hashing by hand here would also violate this codebase's "never hand-roll
 * Better Auth's own tables" rule in spirit, even though technically this
 * would just be inserting rows rather than creating tables. Going through
 * `auth.api.signUpEmail` guarantees the seeded owner is a fully real,
 * sign-in-able account, exercising the exact same code path a real signup
 * does.
 */
async function findOrCreateSeedOwner() {
  const existing = await findUserByEmail(SEED_OWNER_EMAIL);
  if (existing) {
    console.log(`Seed owner already exists (${existing.email}), reusing.`);
    return existing;
  }

  const { user } = await auth.api.signUpEmail({
    body: {
      name: SEED_OWNER_NAME,
      email: SEED_OWNER_EMAIL,
      password: SEED_OWNER_PASSWORD,
    },
  });
  console.log(`Created seed owner ${user.email} (password: ${SEED_OWNER_PASSWORD}).`);
  return user;
}

async function findOrCreateSeedOrg(ownerUserId: string) {
  const existing = await findOrganizationByOwner(ownerUserId);
  if (existing) {
    console.log(`Seed org already exists (${existing.name}), reusing.`);
    return existing;
  }

  const org = await insertOrganization({ name: SEED_ORG_NAME, ownerUserId });
  console.log(`Created seed org "${org.name}" (${org.id}).`);
  return org;
}

async function ensureOwnerMembership(orgId: string, userId: string) {
  const existing = await findAnyMemberOfOrg(orgId);
  if (existing) {
    console.log("Owner membership row already exists, reusing.");
    return existing;
  }

  const membership = await addMember({ orgId, userId, role: "owner" });
  console.log(`Created owner membership (${membership.id}).`);
  return membership;
}


async function main() {
  const owner = await findOrCreateSeedOwner();
  const org = await findOrCreateSeedOrg(owner.id);
  await ensureOwnerMembership(org.id, owner.id);
  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
