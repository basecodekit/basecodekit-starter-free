import { DeleteAccountSection } from "./delete-account-section";
import { ProfileSection } from "./profile-section";
import { SecuritySection } from "./security-section";
import { SessionsSection } from "./sessions-section";
import type { AccountViewProps } from "./types";

/** The account page's markup: every section stacked. Data-free: the page
 * and `/dev/preview/dashboard` pass what it shows. */
export function AccountView({ profile, security, sessions, deletion, uploadsEnabled }: AccountViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-16">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile, sign-in and security for {profile.email}.</p>
      </div>
      <ProfileSection profile={profile} uploadsEnabled={uploadsEnabled} />
      <SecuritySection security={security} />
      <SessionsSection sessions={sessions} />
      <DeleteAccountSection deletion={deletion} />
    </main>
  );
}
