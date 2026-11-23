"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { authClient } from "@/lib/auth-client";

/** Account menu: who's signed in, which org, a link to the account page, the light/dark switch,
 * and sign out. A native `<details>` disclosure — keyboard-accessible with no extra state.
 * `accountHref` lets the preview point the link back into itself. */
export function UserMenu({
  name,
  email,
  orgName,
  accountHref = "/account",
}: {
  name: string;
  email: string;
  orgName: string | null;
  accountHref?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const initial = (name || email).trim().charAt(0).toUpperCase();

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <details className="group relative">
      <summary
        aria-label="Account menu"
        className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 [&::-webkit-details-marker]:hidden"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {initial}
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border bg-popover p-2 text-popover-foreground shadow-card backdrop-blur-surface">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {orgName && <p className="mt-1 truncate text-xs text-muted-foreground">{orgName}</p>}
        </div>
        <div className="my-1 border-t" />
        <Link
          href={accountHref}
          className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          Account settings
        </Link>
        <div className="my-1 border-t" />
        <ThemeSwitcher className="px-2 py-1" />
        <div className="my-1 border-t [display:var(--theme-switch-display)]" />
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
