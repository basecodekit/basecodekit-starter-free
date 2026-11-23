import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { listMembers } from "@/db/repo";
import { requireOrgAccess } from "@/lib/require-org-access";
import { isStorageConfigured, orgLogoUrl } from "@/lib/storage";
import { DASHBOARD_VIEWS } from "@/components/dashboard/layouts";
import { dashboardLayout } from "@/config/layout.config";
import { CreateOrgView } from "./settings-view";


/**
 * Org settings (Step 2.3): the single place org creation, the member list,
 * role management and invites live. It shows "create an org" or "manage
 * your org" depending on whether the signed-in user has one — the
 * dashboard overview links here for the former.
 */
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess (default `minRole: "member"`
  // — any active member may view this page; role-gated mutations happen
  // server-side in `/api/org/members/[memberId]` and `/api/org/invites`,
  // not here).
  const access = await requireOrgAccess(await headers());

  if (!access.ok && access.reason === "unauthenticated") {
    redirect("/login?callbackURL=/settings");
  }

  if (!access.ok) {
    // `no-membership`: a legitimate render state (hasn't created an org
    // yet), not an error — `requireOrgAccess`'s 401/403/404 status codes are
    // for API routes; this Server Component branches on the reason instead.
    return <CreateOrgView />;
  }

  const query = await searchParams;
  const members = await listMembers(access.organization.id);


  const { Settings } = DASHBOARD_VIEWS[dashboardLayout];
  return (
    <Settings
      orgId={access.organization.id}
      orgName={access.organization.name}
      logoUrl={orgLogoUrl(access.organization)}
      uploadsEnabled={isStorageConfigured()}
      currentUserId={access.user.id}
      role={access.membership.role}
      members={members}
      tab={query.tab}
    />
  );
}
