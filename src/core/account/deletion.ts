import type { AccountDeletion } from "@/app/(dashboard)/account/types";
import type { Organization } from "@/db/models";
import { countMembers, deleteUserWithSoleOwnedOrg, findOrganizationByOwner } from "@/db/repo";

/**
 * What deleting the account would do. An org the user owns that still has
 * other members blocks it (ownership must move, or the org go, first); an
 * org with the user as its only member goes along with the account.
 */
export async function loadAccountDeletion(userId: string): Promise<AccountDeletion> {
  const owned = await findOrganizationByOwner(userId);
  if (!owned) return { blockedBy: null, deletesOrg: null };
  const members = await countMembers(owned.id);
  return members > 1
    ? { blockedBy: { orgName: owned.name }, deletesOrg: null }
    : { blockedBy: null, deletesOrg: { orgName: owned.name } };
}

export type DeleteAccountResult =
  | { ok: true; deletedOrg: Organization | null }
  | { ok: false; reason: "blocked-by-members"; orgName: string }
  ;

/**
 * Deletes the user, and the org they own when they are its only member,
 * atomically (see `deleteUserWithSoleOwnedOrg`). Other orgs are untouched.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  const result = await deleteUserWithSoleOwnedOrg(userId);
  if (result.ok) return result;
  return { ok: false, reason: "blocked-by-members", orgName: result.org.name };
}
