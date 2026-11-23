import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_VIEWS } from "@/components/dashboard/layouts";
import { dashboardLayout } from "@/config/layout.config";
import { loadAccountDeletion } from "@/core/account/deletion";
import { loadAccountProfile } from "@/core/account/profile";
import { loadAccountSecurity } from "@/core/account/security";
import { loadAccountSessions } from "@/core/account/sessions";
import { auth } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/storage";

/**
 * The signed-in person's own account: profile, password and two-factor,
 * signed-in browsers, and deleting the account. Personal, not org-scoped,
 * so it needs a session but no org — it renders for a user with none.
 */
export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect("/login?callbackURL=/account");
  }
  const { user } = session;

  const [profile, security, sessions, deletion] = await Promise.all([
    loadAccountProfile(user),
    loadAccountSecurity(requestHeaders, user.id),
    loadAccountSessions(requestHeaders, session.session.id),
    loadAccountDeletion(user.id),
  ]);

  const { Account } = DASHBOARD_VIEWS[dashboardLayout];
  return (
    <Account
      profile={profile}
      security={security}
      sessions={sessions}
      deletion={deletion}
      uploadsEnabled={isStorageConfigured()}
      tab={(await searchParams).tab}
    />
  );
}
