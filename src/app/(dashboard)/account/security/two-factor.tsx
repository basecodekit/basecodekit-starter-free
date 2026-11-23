"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";

type Action = "enable" | "disable" | "regenerate";

const inputClass = "rounded-md border border-input px-3 py-2 text-sm";
const primaryClass =
  "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";
const outlineClass =
  "rounded-md border border-input px-3 py-2 text-sm font-medium disabled:opacity-50";

/** Backup codes, shown once, with copy and download. */
function BackupCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([`${text}\n`], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex max-w-sm flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Save these backup codes somewhere safe. Each can be used once to sign in
        if you lose access to your authenticator app.{" "}
        <strong>They are shown only once, right now.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-md border border-input p-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={outlineClass}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={download} className={outlineClass}>
          Download
        </button>
        <button type="button" onClick={onDone} className={primaryClass}>
          I saved them
        </button>
      </div>
    </div>
  );
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Enrollment, after the password step: scan, then confirm with a code.
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Same manual-entry fallback the sign-up form shows under its QR code.
  const manualSecret = totpUri
    ? new URL(totpUri).searchParams.get("secret")
    : null;

  function reset() {
    setAction(null);
    setPassword("");
    setError(null);
    setTotpUri(null);
    setQrDataUrl(null);
    setCode("");
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setError(null);
    setMessage(null);
    setPending(true);

    if (action === "enable") {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password,
        method: "totp",
      });
      if (enableError || !data || data.method !== "totp") {
        setPending(false);
        setError(
          enableError?.message ?? "Could not start authenticator app setup.",
        );
        return;
      }
      setTotpUri(data.totpURI);
      setQrDataUrl(await QRCode.toDataURL(data.totpURI));
      // Shown once the code below is confirmed, never before.
      setBackupCodes(data.backupCodes);
      setPending(false);
      setPassword("");
      return;
    }

    if (action === "disable") {
      const { error: disableError } = await authClient.twoFactor.disable({
        password,
      });
      setPending(false);
      if (disableError) {
        setError(
          disableError.message ??
            "Could not turn off two-factor authentication.",
        );
        return;
      }
      reset();
      setMessage("Two-factor authentication is off.");
      router.refresh();
      return;
    }

    const { data, error: regenerateError } =
      await authClient.twoFactor.generateBackupCodes({ password });
    setPending(false);
    if (regenerateError || !data) {
      setError(
        regenerateError?.message ?? "Could not generate new backup codes.",
      );
      return;
    }
    reset();
    setBackupCodes(data.backupCodes);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    // With an active session and a not yet verified secret this confirms the
    // enrollment rather than completing a sign-in challenge.
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code,
    });
    setPending(false);
    if (verifyError) {
      setError(verifyError.message ?? "That code didn't work.");
      return;
    }
    const codes = backupCodes;
    reset();
    setBackupCodes(codes);
    setMessage("Two-factor authentication is on.");
    router.refresh();
  }

  const verifying = action === "enable" && totpUri !== null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        Two-factor authentication
      </h3>
      <p className="text-sm text-muted-foreground">
        {enabled
          ? "Signing in needs a code from your authenticator app, on top of your password."
          : "Add an extra layer of security with a time-based code from an authenticator app like Google Authenticator, Authy, or 1Password."}
      </p>

      {backupCodes && !verifying ? (
        <BackupCodes codes={backupCodes} onDone={() => setBackupCodes(null)} />
      ) : verifying ? (
        <div className="flex max-w-sm flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the
            6-digit code it shows.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image
            <img
              src={qrDataUrl}
              alt="Scan this QR code with your authenticator app"
              width={200}
              height={200}
            />
          )}
          {manualSecret && (
            <p className="break-all text-xs text-muted-foreground">
              Can&apos;t scan it? Enter this key manually:{" "}
              <code>{manualSecret}</code>
            </p>
          )}
          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              6-digit code
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-describedby={error ? "two-factor-error" : undefined}
                className={`${inputClass} tracking-widest`}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className={primaryClass}>
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setBackupCodes(null);
                }}
                className={outlineClass}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : action ? (
        <form
          onSubmit={handlePassword}
          className="flex max-w-sm flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm">
            Confirm your password
            <input
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "two-factor-error" : undefined}
              className={inputClass}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primaryClass}>
              {action === "enable"
                ? "Continue"
                : action === "disable"
                  ? "Turn off"
                  : "Generate new codes"}
            </button>
            <button type="button" onClick={reset} className={outlineClass}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setAction("regenerate");
                }}
                className={outlineClass}
              >
                New backup codes
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setAction("disable");
                }}
                className={outlineClass}
              >
                Turn off
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setAction("enable");
              }}
              className={primaryClass}
            >
              Enable an authenticator app
            </button>
          )}
        </div>
      )}

      {error && (
        <p
          id="two-factor-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      )}
    </div>
  );
}
