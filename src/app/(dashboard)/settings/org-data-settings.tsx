"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** `DELETE /api/org` with the typed name, which the server checks again,
 * then back to the dashboard. */
export function useDeleteOrg() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteOrg(confirmName: string) {
    setError(null);
    setPending(true);
    const response = await fetch("/api/org", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmName }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not delete the organization.");
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return { deleteOrg, pending, error, setError };
}

/**
 * The owner's export and delete controls for the org's data. The name check
 * here only saves a round trip; `DELETE /api/org` checks it again.
 */
export function OrgDataSettings({ orgName }: { orgName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");
  const { deleteOrg: deleteNamed, pending, error, setError } = useDeleteOrg();
  const deleteOrg = () => deleteNamed(typedName);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Your organization&apos;s data</h2>
      <div>
        <a
          href="/api/org/export"
          download
          className="inline-block rounded-md border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Download a copy (JSON)
        </a>
        <p className="mt-2 text-xs text-muted-foreground">The organization, its members and invites.</p>
      </div>

      <div className="mt-4 rounded-md border border-destructive/40 p-4">
        <h3 className="text-sm font-medium text-foreground">Delete organization</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes {orgName} and everything stored about it. Members keep their accounts but lose access.
          This can&apos;t be undone.
        </p>
        {confirming ? (
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void deleteOrg();
            }}
          >
            <label htmlFor="confirm-org-name" className="text-sm text-foreground">
              Type <span className="font-semibold">{orgName}</span> to confirm
            </label>
            <input
              id="confirm-org-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="off"
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending || typedName.trim() !== orgName}
                className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  setTypedName("");
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
            Delete organization…
          </button>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </section>
  );
}
