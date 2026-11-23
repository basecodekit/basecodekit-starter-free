import type { AccountProfile } from "@/app/(dashboard)/account/types";

/** Placeholder. */
export async function loadAccountProfile(user: { id: string; name: string; email: string; image?: string | null; emailVerified: boolean }): Promise<AccountProfile> {
  return { id: user.id, name: user.name, email: user.email, image: user.image ?? null, emailVerified: user.emailVerified };
}
