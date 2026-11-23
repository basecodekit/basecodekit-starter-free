import type { ComponentType } from "react";
import type { DashboardLayout } from "@/types/config";
import { AccountView } from "@/app/(dashboard)/account/account-view";
import type { AccountViewProps } from "@/app/(dashboard)/account/types";
import { DashboardShell, type DashboardShellProps } from "./dashboard-shell";
import { OrgSettingsView, type OrgSettingsViewProps } from "@/app/(dashboard)/settings/settings-view";
import { DashboardOverview, type DashboardOverviewProps } from "./overview";

export interface DashboardViews {
  Shell: ComponentType<DashboardShellProps>;
  Overview: ComponentType<DashboardOverviewProps>;
  Settings: ComponentType<OrgSettingsViewProps>;
  Account: ComponentType<AccountViewProps>;
}

/**
 * Dashboard layout → its chrome and page views, picked by `dashboardLayout`
 * in `layout.config.ts` the way archetypes pick landing-page slots. Every
 * layout's views take the same props, so pages load data once and render
 * whichever layout is configured. Adding a layout is one entry here;
 * `DashboardLayout` makes a missing one a type error.
 */
export const DASHBOARD_VIEWS: Record<DashboardLayout, DashboardViews> = {
  topnav: {
    Shell: DashboardShell,
    Overview: DashboardOverview,
    Settings: OrgSettingsView,
    Account: AccountView,
  },
};
