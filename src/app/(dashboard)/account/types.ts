/** What the account page shows, loaded by `src/core/account/*` and made up
 * by `/dev/preview/dashboard`. Plain data, so both layouts' views and the
 * preview share it. Dates are ISO strings. */

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  /** Avatar URL, or `null` for the initial. */
  image: string | null;
  emailVerified: boolean;
}

export interface AccountSecurity {
  /** Has an email/password login. OAuth- or magic-link-only accounts have
   * none, so there is no password to change and 2FA can't be confirmed. */
  hasPassword: boolean;
  /** `authConfig.totpMfa`: the app offers two-factor at all. */
  totpAvailable: boolean;
  twoFactorEnabled: boolean;
}

/** A signed-in browser. Never carries the session token: revoking goes
 * through the server by id. */
export interface AccountSession {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface AccountDeletion {
  /** Set when the account can't be deleted yet: the user owns an org that
   * still has other members, so ownership must move or the org go first. */
  blockedBy: { orgName: string } | null;
  /** The org that goes with the account (the user is its only member). */
  deletesOrg: { orgName: string } | null;
}

export interface AccountViewProps {
  profile: AccountProfile;
  security: AccountSecurity;
  sessions: AccountSession[];
  deletion: AccountDeletion;
  /** Avatar uploads need object storage (`isStorageConfigured()`). */
  uploadsEnabled: boolean;
  /** `?tab=`, for layouts that split the page into sections. */
  tab?: string | string[];
  /** Preview only: where each section's link goes instead of `?tab=`. */
  tabHrefs?: Partial<Record<string, string>>;
}
