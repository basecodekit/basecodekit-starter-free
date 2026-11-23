"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { AccountProfile } from "./types";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;

type Notice = { kind: "ok" | "error"; text: string } | null;

function Message({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role={notice.kind === "error" ? "alert" : "status"} className={`text-sm ${notice.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
      {notice.text}
    </p>
  );
}

/**
 * The signed-in person's name, email address and picture. The checks here
 * only save a round trip; the server re-checks the name, rate-limits email
 * changes, and checks an uploaded picture's real type and size.
 */
export function ProfileSection({ profile, uploadsEnabled }: { profile: AccountProfile; uploadsEnabled: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<Notice>(null);

  const [name, setName] = useState(profile.name);
  const [namePending, setNamePending] = useState(false);
  const [nameNotice, setNameNotice] = useState<Notice>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailNotice, setEmailNotice] = useState<Notice>(null);

  const [resendPending, setResendPending] = useState(false);
  const [resendNotice, setResendNotice] = useState<Notice>(null);

  async function uploadAvatar(file: File) {
    setAvatarNotice(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setAvatarNotice({ kind: "error", text: "The picture must be a PNG, JPEG or WebP image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setAvatarNotice({ kind: "error", text: "The picture must be 2 MB or smaller." });
      return;
    }

    setAvatarPending(true);
    try {
      const ticket = await fetch("/api/account/profile/avatar/upload-url", {
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

      const confirm = await fetch("/api/account/profile/avatar", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: ticketBody.key }),
      });
      const confirmBody = await confirm.json().catch(() => ({}));
      if (!confirm.ok) throw new Error(confirmBody.error ?? "Could not save the picture.");

      router.refresh();
    } catch (err) {
      setAvatarNotice({ kind: "error", text: err instanceof Error ? err.message : "Could not upload the picture." });
    } finally {
      setAvatarPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    setAvatarNotice(null);
    setAvatarPending(true);
    const response = await fetch("/api/account/profile/avatar", { method: "DELETE" });
    setAvatarPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setAvatarNotice({ kind: "error", text: body.error ?? "Could not remove the picture." });
      return;
    }
    router.refresh();
  }

  async function saveName() {
    setNameNotice(null);
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_NAME_LENGTH) {
      setNameNotice({ kind: "error", text: `Name is required and must be at most ${MAX_NAME_LENGTH} characters.` });
      return;
    }
    setNamePending(true);
    const { error } = await authClient.updateUser({ name: trimmed });
    setNamePending(false);
    if (error) {
      setNameNotice({ kind: "error", text: error.message ?? "Could not save your name." });
      return;
    }
    setNameNotice({ kind: "ok", text: "Name saved." });
    router.refresh();
  }

  async function changeEmail() {
    setEmailNotice(null);
    setEmailPending(true);
    const { error } = await authClient.changeEmail({ newEmail: newEmail.trim(), callbackURL: "/account" });
    setEmailPending(false);
    if (error) {
      setEmailNotice({ kind: "error", text: error.message ?? "Could not change your email." });
      return;
    }
    setNewEmail("");
    setEmailNotice({
      kind: "ok",
      text: profile.emailVerified
        ? `We sent an approval link to ${profile.email}. After you approve it, we send a confirmation link to the new address. Your email changes once both are done.`
        : "We sent a confirmation link to the new address. Your email changes once you follow it.",
    });
  }

  async function resendVerification() {
    setResendNotice(null);
    setResendPending(true);
    const { error } = await authClient.sendVerificationEmail({ email: profile.email, callbackURL: "/account" });
    setResendPending(false);
    setResendNotice(
      error
        ? { kind: "error", text: error.message ?? "Could not send the email." }
        : { kind: "ok", text: `Confirmation link sent to ${profile.email}.` },
    );
  }

  const initial = (profile.name || profile.email).trim().charAt(0).toUpperCase();

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-base font-semibold">Profile</h2>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Picture</h3>
        <div className="flex flex-wrap items-center gap-4">
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.image} alt="" className="h-16 w-16 rounded-full border object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted/30 text-xl font-medium text-muted-foreground"
            >
              {initial}
            </span>
          )}
          {uploadsEnabled && (
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="peer sr-only"
                id="account-avatar-input"
                disabled={avatarPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
              <label
                htmlFor="account-avatar-input"
                className="cursor-pointer rounded-md bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 px-3 py-2 text-sm font-medium text-primary-foreground aria-disabled:opacity-50"
                aria-disabled={avatarPending}
              >
                {avatarPending ? "Saving…" : profile.image ? "Replace" : "Upload"}
              </label>
              {profile.image && (
                <button
                  type="button"
                  disabled={avatarPending}
                  onClick={removeAvatar}
                  className="text-sm text-destructive underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
        {uploadsEnabled && <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>}
        <Message notice={avatarNotice} />
      </div>

      <form
        className="flex max-w-md flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void saveName();
        }}
      >
        <label htmlFor="account-name" className="text-sm font-semibold text-foreground">
          Name
        </label>
        <input
          id="account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={MAX_NAME_LENGTH}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={namePending || name.trim() === profile.name || !name.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {namePending ? "Saving…" : "Save name"}
          </button>
        </div>
        <Message notice={nameNotice} />
      </form>

      <div className="flex max-w-md flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Email</h3>
        <p className="text-sm text-foreground">
          {profile.email}{" "}
          <span className="text-xs text-muted-foreground">{profile.emailVerified ? "(verified)" : "(not verified)"}</span>
        </p>
        {!profile.emailVerified && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={resendPending}
              onClick={resendVerification}
              className="self-start text-sm underline disabled:opacity-50"
            >
              {resendPending ? "Sending…" : "Send a confirmation link"}
            </button>
            <Message notice={resendNotice} />
          </div>
        )}
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void changeEmail();
          }}
        >
          <label htmlFor="account-new-email" className="text-sm text-foreground">
            New email address
          </label>
          <input
            id="account-new-email"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={emailPending || !newEmail.trim()}
              className="rounded-md border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {emailPending ? "Sending…" : "Change email"}
            </button>
          </div>
          <Message notice={emailNotice} />
        </form>
      </div>
    </section>
  );
}
