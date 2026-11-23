import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { DashboardNav } from "./dashboard-nav";
import { UserMenu } from "./user-menu";

export interface DashboardShellProps {
  user: { name: string; email: string };
  orgName: string | null;
  logoSrc: string | null;
  /** Preview only: the active section's href, and where each section's
   * link goes instead of its real path (keyed by that path). */
  nav?: { activeHref: string; hrefs: Partial<Record<string, string>> };
  children: ReactNode;
}

/** Signed-in chrome: brand, section nav, account menu. Data-free, so the
 * dashboard layout and `/dev/preview/dashboard` render the same markup. */
export function DashboardShell({ user, orgName, logoSrc, nav, children }: DashboardShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        {/* Small screens: brand + account on one row, nav on its own row
            below, so every section stays visible without scrolling. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link href={nav?.hrefs["/dashboard"] ?? "/dashboard"} className="shrink-0 font-heading font-semibold">
            <BrandMark orgLogo={logoSrc && orgName ? { src: logoSrc, alt: orgName } : null} />
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto">
            <DashboardNav activeHref={nav?.activeHref} hrefs={nav?.hrefs} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {orgName && (
              <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">{orgName}</span>
            )}
            <UserMenu name={user.name} email={user.email} orgName={orgName} accountHref={nav?.hrefs["/account"]} />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
