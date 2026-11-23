import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DASHBOARD_VIEWS } from "@/components/dashboard/layouts";
import { dashboardLayout } from "@/config/layout.config";
import { auth } from "@/lib/auth";
import { requireOrgAccess } from "@/lib/require-org-access";
import { orgLogoUrl } from "@/lib/storage";

/**
 * Shell for every signed-in page: brand, section nav, account menu, in the
 * chrome `dashboardLayout` picks.
 *
 * Auth is layered: `src/proxy.ts` bounces requests with no session cookie
 * (keeping the path for after sign-in); this layout verifies the session
 * for real; and each page still gates its own data with `requireOrgAccess`,
 * because layouts and pages render in parallel — a layout redirect alone
 * can't stop a page's queries.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  // ORG-SCOPED-QUERY: gated by requireOrgAccess — the shell only shows the
  // org's name. It also verifies the session, so the usual case costs one
  // lookup; only a user with no org yet needs the session fetched again.
  const access = await requireOrgAccess(requestHeaders);
  if (!access.ok && access.reason === "unauthenticated") {
    redirect("/login");
  }
  const user = access.ok ? access.user : (await auth.api.getSession({ headers: requestHeaders }))?.user;
  if (!user) {
    redirect("/login");
  }
  const orgName = access.ok ? access.organization.name : null;
  const logoSrc = access.ok ? orgLogoUrl(access.organization) : null;

  const { Shell: DashboardShell } = DASHBOARD_VIEWS[dashboardLayout];
  return (
    <DashboardShell user={{ name: user.name, email: user.email }} orgName={orgName} logoSrc={logoSrc}>
      {children}
    </DashboardShell>
  );
}
