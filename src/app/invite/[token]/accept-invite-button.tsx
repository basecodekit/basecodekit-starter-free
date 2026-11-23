"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setPending(true);

    const response = await fetch(`/api/org/invites/${token}/accept`, { method: "POST" });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not accept this invite.");
      return;
    }
    router.push("/settings?tab=members");
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Accept invite
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
