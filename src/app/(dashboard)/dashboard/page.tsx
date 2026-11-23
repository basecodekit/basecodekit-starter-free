import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_VIEWS } from "@/components/dashboard/layouts";
import { CreateOrgPrompt } from "@/components/dashboard/overview";
import { dashboardLayout } from "@/config/layout.config";
import { countMembers } from "@/db/repo";
import { requireOrgAccess } from "@/lib/require-org-access";

/** Signed-in home: the org at a glance, with a way into each section. Where
 * every sign-in lands unless it was headed somewhere specific. */
export default async function DashboardPage() {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess (any member may view).
  const access = await requireOrgAccess(await headers());
  if (!access.ok && access.reason === "unauthenticated") {
    redirect("/login?callbackURL=/dashboard");
  }

  if (!access.ok) {
    return <CreateOrgPrompt />;
  }

  const orgId = access.organization.id;
  const members = await countMembers(orgId);

  const { Overview } = DASHBOARD_VIEWS[dashboardLayout];
  return (
    <Overview
      firstName={access.user.name.split(" ")[0] || access.user.name}
      orgName={access.organization.name}
      role={access.membership.role}
      members={members}
    />
  );
}
