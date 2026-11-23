/** The account page's sections, as `/account?tab=`. No component imports,
 * so the preview's URL state can use it. */
export const ACCOUNT_TABS = ["profile", "security", "sessions", "delete"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export const ACCOUNT_TAB_LABELS: Record<AccountTab, string> = {
  profile: "Profile",
  security: "Security",
  sessions: "Sessions",
  delete: "Delete account",
};

/** `?tab=` as one of the tabs, else Profile. */
export function resolveAccountTab(value: string | string[] | undefined): AccountTab {
  return ACCOUNT_TABS.find((tab) => tab === value) ?? "profile";
}
