"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Dashboard sections. Adding a page under `app/(dashboard)` means adding it
 * here and to `src/proxy.ts`'s matcher (a test checks the latter). */
export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/settings", label: "Settings" },
] as const;

export type DashboardHref = (typeof DASHBOARD_NAV)[number]["href"];

/** `activeHref` and `hrefs` let `/dev/preview/dashboard` mark a section
 * active and point the links back into the preview; pages pass neither. */
export function DashboardNav({
  activeHref,
  hrefs,
}: {
  activeHref?: string;
  hrefs?: Partial<Record<string, string>>;
} = {}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto">
      {DASHBOARD_NAV.map((item) => {
        const active = activeHref
          ? activeHref === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={hrefs?.[item.href] ?? item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
