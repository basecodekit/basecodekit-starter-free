import type { MemberListItem, OrgRole } from "@/db/models";
import { CreateOrgForm } from "./create-org-form";
import { OrgDataSettings } from "./org-data-settings";
import { OrgLogoSettings } from "./org-logo-settings";
import { OrgSettingsClient } from "./org-settings-client";

/** Signed in, but in no organization yet. */
export function CreateOrgView() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-32">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Create your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t belong to an organization yet. Create one to invite teammates.
        </p>
      </div>
      <CreateOrgForm />
    </main>
  );
}

export interface OrgSettingsViewProps {
  orgId: string;
  orgName: string;
  logoUrl: string | null;
  uploadsEnabled: boolean;
  currentUserId: string;
  role: OrgRole;
  members: MemberListItem[];
  /** `?tab=`, for layouts that split settings into sections. */
  tab?: string | string[];
  /** Preview only: where each section's link goes instead of `?tab=`. */
  tabHrefs?: Partial<Record<string, string>>;
}

/** The settings page's markup. Data-free: the page and
 * `/dev/preview/dashboard` pass what it shows. */
export function OrgSettingsView({
  orgName,
  logoUrl,
  uploadsEnabled,
  currentUserId,
  role,
  members,
}: OrgSettingsViewProps) {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{orgName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Logo, members and roles for your organization.</p>
        </div>
      </div>
      <OrgLogoSettings logoUrl={logoUrl} orgName={orgName} canManage={role !== "member"} uploadsEnabled={uploadsEnabled} />
      <OrgSettingsClient currentUserId={currentUserId} currentRole={role} members={members} />
      {role === "owner" && <OrgDataSettings orgName={orgName} />}
    </main>
  );
}
