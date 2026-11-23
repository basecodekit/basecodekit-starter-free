"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The org's logo, with upload and remove controls for owners/admins. The
 * checks here only save a round trip; the server re-checks the role, and
 * the file's real type and size after upload.
 */
export function OrgLogoSettings({
  logoUrl,
  orgName,
  canManage,
  uploadsEnabled,
}: {
  logoUrl: string | null;
  orgName: string;
  canManage: boolean;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("The logo must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The logo must be 2 MB or smaller.");
      return;
    }

    setPending(true);
    try {
      const ticket = await fetch("/api/org/logo/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      const ticketBody = await ticket.json().catch(() => ({}));
      if (!ticket.ok) throw new Error(ticketBody.error ?? "Could not start the upload.");

      const put = await fetch(ticketBody.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("The upload failed. Try again.");

      const confirm = await fetch("/api/org/logo", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: ticketBody.key }),
      });
      const confirmBody = await confirm.json().catch(() => ({}));
      if (!confirm.ok) throw new Error(confirmBody.error ?? "Could not save the logo.");

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload the logo.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setPending(true);
    const response = await fetch("/api/org/logo", { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not remove the logo.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">Logo</h2>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 min-w-32 items-center justify-center rounded-md border bg-muted/30 px-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${orgName} logo`} className="max-h-12 w-auto" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>
        {canManage && uploadsEnabled && (
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="peer sr-only"
              id="org-logo-input"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <label
              htmlFor="org-logo-input"
              className="cursor-pointer rounded-md bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 px-3 py-2 text-sm font-medium text-primary-foreground aria-disabled:opacity-50"
              aria-disabled={pending}
            >
              {pending ? "Saving…" : logoUrl ? "Replace" : "Upload"}
            </label>
            {logoUrl && (
              <button
                type="button"
                disabled={pending}
                onClick={remove}
                className="text-sm text-destructive underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
      {canManage && uploadsEnabled && (
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB. Shown in your dashboard and invite emails.</p>
      )}
      {canManage && !uploadsEnabled && (
        <p className="text-xs text-muted-foreground">Logo uploads are not configured on this server.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
