"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { describeUserAgent } from "@/core/account/user-agent";
import { buttonClasses } from "@/components/ui";
import type { AccountSession } from "./types";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Signed-in browsers, with sign-out for one or for all but this one. The
 * routes under `/api/account/sessions` check ownership; this only calls them. */
export function SessionsSection({ sessions }: { sessions: AccountSession[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const others = sessions.filter((session) => !session.current);
  const busy = pendingId !== null;

  async function run(id: string, request: () => Promise<Response>, failure: string) {
    setError(null);
    setPendingId(id);
    const response = await request().catch(() => null);
    setPendingId(null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({}));
      setError(body?.error ?? failure);
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Sessions</h2>
          <p className="text-sm text-muted-foreground">Browsers and devices signed in to your account.</p>
        </div>
        <button
          type="button"
          disabled={busy || others.length === 0}
          onClick={() =>
            run("all", () => fetch("/api/account/sessions/revoke-others", { method: "POST" }), "Could not sign out the other sessions.")
          }
          className={buttonClasses({ variant: "outline" })}
        >
          Sign out all other sessions
        </button>
      </div>

      <ul className="flex flex-col divide-y rounded-md border">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                {describeUserAgent(session.userAgent)}
                {session.current && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">This device</span>
                )}
              </div>
              <div className="break-words text-muted-foreground">
                {session.ipAddress ?? "Unknown IP"} · Last active {dateFormat.format(new Date(session.updatedAt))} UTC
              </div>
            </div>
            {!session.current && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(session.id, () => fetch(`/api/account/sessions/${session.id}`, { method: "DELETE" }), "Could not sign out this session.")
                }
                className="self-start text-destructive underline disabled:opacity-50 sm:self-auto"
              >
                {pendingId === session.id ? "Signing out…" : "Sign out"}
              </button>
            )}
          </li>
        ))}
      </ul>

      {others.length === 0 && <p className="text-sm text-muted-foreground">You&apos;re only signed in on this device.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
