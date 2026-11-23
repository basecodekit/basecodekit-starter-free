"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDeletion } from "./types";

const CONFIRM_PHRASE = "delete my account";

/**
 * Deleting the account, behind a type-the-phrase confirmation. The rules
 * live on the server (`DELETE /api/account/delete`): it re-checks the typed
 * phrase and refuses while the user owns an org that has other members. What
 * is shown here only explains them.
 */
export function DeleteAccountSection({ deletion }: { deletion: AccountDeletion }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setError(null);
    setPending(true);
    const response = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not delete your account.");
      setPending(false);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Delete account</h2>
      <div className="rounded-md border border-destructive/40 p-4">
        <p className="text-sm text-muted-foreground">
          Permanently deletes your account and everything stored about you. This can&apos;t be undone.
        </p>
        {deletion.blockedBy && (
          <p role="status" className="mt-2 text-sm text-foreground">
            You own {deletion.blockedBy.orgName}, which still has other members. Transfer its ownership or delete the
            organization first, then come back here.
          </p>
        )}
        {deletion.deletesOrg && (
          <p className="mt-2 text-sm text-foreground">
            You are the only member of {deletion.deletesOrg.orgName}, so it is deleted along with your account.
          </p>
        )}
        {!deletion.blockedBy &&
          (confirming ? (
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
            >
              <label htmlFor="confirm-account-email" className="text-sm text-foreground">
                Type <span className="font-semibold">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                id="confirm-account-email"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pending || typed.trim().toLowerCase() !== CONFIRM_PHRASE}
                  className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-50"
                >
                  {pending ? "Deleting…" : "Delete permanently"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setConfirming(false);
                    setTyped("");
                    setError(null);
                  }}
                  className="text-sm text-muted-foreground underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive"
            >
              Delete account…
            </button>
          ))}
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
