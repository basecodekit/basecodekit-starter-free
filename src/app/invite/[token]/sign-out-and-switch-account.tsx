"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutAndSwitchAccount({ callbackURL, email }: { callbackURL: string; email: string }) {
  const router = useRouter();

  async function handleClick() {
    await authClient.signOut();
    const query = new URLSearchParams({ callbackURL, email }).toString();
    router.push(`/login?${query}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-sm font-medium text-foreground underline"
    >
      Sign out and sign in as {email}
    </button>
  );
}
