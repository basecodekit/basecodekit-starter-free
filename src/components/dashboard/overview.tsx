import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import type { OrgRole } from "@/db/models";

const card = "rounded-xl border bg-card p-6 text-card-foreground shadow-card backdrop-blur-surface";
const ORG_INTRO = "Everything here — your team and its settings — belongs to an organization.";

/** Signed in, but in no organization yet. */
export function CreateOrgPrompt({ createHref = "/settings" }: { createHref?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10">
      <section className={`${card} max-w-xl`}>
        <h1 className="font-heading text-xl font-semibold">Welcome — let&apos;s set up your organization</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ORG_INTRO} Create yours to get started.</p>
        <ButtonLink href={createHref} className="mt-6">
          Create organization
        </ButtonLink>
      </section>
    </main>
  );
}

export interface DashboardOverviewProps {
  firstName: string;
  orgName: string;
  role: OrgRole;
  members: number;
  /** Preview only: where the section links go. */
  hrefs?: {
    settings: string;
    members?: string;
  };
}

/** The org at a glance, with a way into each section. Data-free: the
 * dashboard page and `/dev/preview/dashboard` pass what it shows. */
export function DashboardOverview({
  firstName,
  orgName,
  role,
  members,
  hrefs,
}: DashboardOverviewProps) {

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orgName} · <span className="capitalize">{role}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">

        <section aria-labelledby="team-heading" className={card}>
          <h2 id="team-heading" className="text-sm text-muted-foreground">
            Team
          </h2>
          <p className="mt-1 font-heading text-4xl font-semibold tabular-nums">{members}</p>
          <p className="mt-2 text-sm text-muted-foreground">{members === 1 ? "member" : "members"}</p>
          <Link href={hrefs?.settings ?? "/settings"} className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline">
            Manage members →
          </Link>
        </section>
      </div>

    </main>
  );
}
