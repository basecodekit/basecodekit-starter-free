import type { AccountSecurity } from "@/app/(dashboard)/account/types";
import { auth } from "@/lib/auth";
import { authConfig } from "@/config/auth.config";

/**
 * Password and two-factor state for the account page. Read through Better
 * Auth's own session and account endpoints for the caller's cookie, so it
 * can only ever describe the signed-in user (`userId` guards against a
 * session that belongs to someone else).
 */
export async function loadAccountSecurity(
  requestHeaders: Headers,
  userId: string,
): Promise<AccountSecurity> {
  const [session, accounts] = await Promise.all([
    auth.api.getSession({ headers: requestHeaders }),
    auth.api.listUserAccounts({ headers: requestHeaders }),
  ]);

  const user = session?.user.id === userId ? session.user : null;

  return {
    hasPassword: accounts.some(
      (account) => account.providerId === "credential",
    ),
    totpAvailable: authConfig.totpMfa,
    twoFactorEnabled: Boolean(
      (user as { twoFactorEnabled?: boolean | null } | null)?.twoFactorEnabled,
    ),
  };
}
