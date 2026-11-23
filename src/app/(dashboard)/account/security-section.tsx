"use client";

import type { AccountSecurity } from "./types";
import { ChangePasswordForm } from "./security/password-form";
import { TwoFactorSettings } from "./security/two-factor";

/** Password and two-factor settings; brings its own heading. */
export function SecuritySection({ security }: { security: AccountSecurity }) {
  const { hasPassword, totpAvailable, twoFactorEnabled } = security;

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="account-security-heading"
    >
      <h2 id="account-security-heading" className="text-base font-semibold">
        Security
      </h2>

      {hasPassword ? (
        <ChangePasswordForm />
      ) : (
        <p className="text-sm text-muted-foreground">
          No password is set on this account. You sign in with a provider or an
          email link, so there is nothing to change here.
        </p>
      )}

      {totpAvailable &&
        (hasPassword || twoFactorEnabled ? (
          <TwoFactorSettings enabled={twoFactorEnabled} />
        ) : (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              Two-factor authentication
            </h3>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication needs a password to confirm changes, and
              this account has none.
            </p>
          </div>
        ))}
    </section>
  );
}
