"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { authConfig } from "@/config/auth.config";
import { SIGNED_IN_HOME, safeCallbackURL } from "@/lib/safe-redirect";

export function SignupForm() {
  // See `(auth)/login/page.tsx` for why this needs a `Suspense` boundary
  // (`useSearchParams` requires one in the App Router).
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // See `(auth)/login/login-form.tsx` — same "come back to where you started"
  // mechanism, used by `/invite/[token]` for a visitor who needs to sign up
  // first before accepting an invite.
  const callbackURL = safeCallbackURL(searchParams.get("callbackURL"));
  const loginQuery = new URLSearchParams();
  if (callbackURL !== SIGNED_IN_HOME) loginQuery.set("callbackURL", callbackURL);
  const loginHref = loginQuery.size > 0 ? `/login?${loginQuery.toString()}` : "/login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passkeyPrompt, setPasskeyPrompt] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyAdded, setPasskeyAdded] = useState(false);

  // No dashboard/account UI exists yet (Phase 2+) to host TOTP enrollment
  // either, so — same rationale as the passkey step below — it runs as its
  // own post-signup step, sequenced *after* the passkey step rather than
  // merged into one combined screen. Keeping each step's heading/markup
  // self-contained means this doesn't have to touch `e2e/passkey.spec.ts`'s
  // existing "Add a passkey"/"Passkey added" locators at all.
  const [totpPrompt, setTotpPrompt] = useState(false);
  const [totpPhase, setTotpPhase] = useState<"offer" | "verify" | "done">("offer");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState<string | null>(null);
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);

  // The manual-entry fallback shown under the QR code (for authenticator
  // apps that support typing a key instead of scanning) doubles as the only
  // way to recover the TOTP secret from `totpUri` outside the database —
  // `e2e/totp.spec.ts` reads this same value to generate a valid code
  // without a second, test-only code path.
  const totpManualSecret = totpUri ? new URL(totpUri).searchParams.get("secret") : null;

  function goHomeOrNextStep() {
    if (authConfig.totpMfa) {
      setPasskeyPrompt(false);
      setTotpPrompt(true);
      return;
    }
    router.push(callbackURL);
  }

  async function handleSocialSignIn(provider: "google" | "github") {
    setError(null);
    setPending(true);

    const { error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL,
    });

    if (socialError) {
      setPending(false);
      setError(socialError.message ?? `Could not sign up with ${provider}.`);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error: signUpError } = await authClient.signUp.email({ name, email, password });

    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not sign up.");
      return;
    }

    // No dashboard/account UI exists yet (Phase 2+) to host passkey/TOTP
    // enrollment, so offer both here as one-time post-signup steps while the
    // session from sign-up is still active — the only window we currently
    // have to call `authClient.passkey.addPasskey()` / `authClient.twoFactor.enable()`
    // without a settings page. Passkey first, then TOTP, so each step's UI
    // stays self-contained (see `goHomeOrNextStep` above).
    if (authConfig.passkeys) {
      setPasskeyPrompt(true);
      return;
    }
    if (authConfig.totpMfa) {
      setTotpPrompt(true);
      return;
    }
    router.push(callbackURL);
  }

  async function handleAddPasskey() {
    setPasskeyError(null);
    setPending(true);

    const { error: addPasskeyError } = await authClient.passkey.addPasskey({ name: "My passkey" });

    setPending(false);
    if (addPasskeyError) {
      setPasskeyError(addPasskeyError.message ?? "Could not add a passkey.");
      return;
    }
    setPasskeyAdded(true);
  }

  async function handleStartTotp() {
    setTotpError(null);
    setPending(true);

    // `enable({ method: "totp" })` both creates the (as yet unverified)
    // secret and returns the freshly-generated backup codes in one call —
    // there's no need to separately call `getTotpUri()` first, and its
    // `totpURI`/`backupCodes` response fields are only present at all when
    // `method === "totp"` (verified against the installed `better-auth`
    // types, `dist/plugins/two-factor/index.d.mts`).
    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
      method: "totp",
    });

    setPending(false);
    if (enableError || !data || data.method !== "totp") {
      setTotpError(enableError?.message ?? "Could not start authenticator app setup.");
      return;
    }

    setTotpUri(data.totpURI);
    setTotpBackupCodes(data.backupCodes);
    setTotpQrDataUrl(await QRCode.toDataURL(data.totpURI));
    setTotpPhase("verify");
  }

  async function handleConfirmTotp(e: React.FormEvent) {
    e.preventDefault();
    setTotpError(null);
    setPending(true);

    // Also the confirmation step for a fresh enrollment (not just a sign-in
    // challenge) — with an active session and an unverified `twoFactor` row,
    // this flips `verified`/`twoFactorEnabled` to true instead of completing
    // a pending 2FA sign-in (verified directly against the installed
    // `better-auth` source, `dist/plugins/two-factor/totp/index.mjs`).
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code: totpCode });

    setPending(false);
    if (verifyError) {
      setTotpError(verifyError.message ?? "That code didn't work.");
      return;
    }
    setTotpPhase("done");
  }

  if (passkeyPrompt) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-32 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {passkeyAdded ? "Passkey added" : "Add a passkey"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {passkeyAdded
            ? "You can now sign in with your device's passkey."
            : "Sign in faster next time using your device's fingerprint, face, or screen lock — no password needed."}
        </p>
        {!passkeyAdded && (
          <button
            type="button"
            onClick={handleAddPasskey}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Add a passkey
          </button>
        )}
        {passkeyError && <p className="text-sm text-destructive">{passkeyError}</p>}
        <button
          type="button"
          onClick={goHomeOrNextStep}
          className="text-sm font-medium text-foreground underline"
        >
          {passkeyAdded ? "Continue" : "Skip for now"}
        </button>
      </main>
    );
  }

  if (totpPrompt) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-32 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          {totpPhase === "done" ? "Two-factor authentication enabled" : "Add two-factor authentication"}
        </h1>

        {totpPhase === "offer" && (
          <>
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security with a time-based code from an authenticator app like Google
              Authenticator, Authy, or 1Password.
            </p>
            <button
              type="button"
              onClick={handleStartTotp}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Enable an authenticator app
            </button>
          </>
        )}

        {totpPhase === "verify" && (
          <>
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
            </p>
            {totpQrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image
              <img
                src={totpQrDataUrl}
                alt="Scan this QR code with your authenticator app"
                width={200}
                height={200}
                className="mx-auto"
              />
            )}
            {totpManualSecret && (
              <p className="break-all text-xs text-muted-foreground">
                Can&apos;t scan it? Enter this key manually: <code>{totpManualSecret}</code>
              </p>
            )}
            <form onSubmit={handleConfirmTotp} className="flex flex-col gap-3">
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                placeholder="6-digit code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="rounded-md border border-input px-3 py-2 text-center text-sm tracking-widest"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Confirm
              </button>
            </form>
          </>
        )}

        {totpPhase === "done" && totpBackupCodes && (
          <>
            <p className="text-sm text-muted-foreground">
              Save these backup codes somewhere safe — each can be used once to sign in if you lose access
              to your authenticator app. <strong>They are shown only once, right now.</strong>
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-md border border-input p-3 font-mono text-sm">
              {totpBackupCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </>
        )}

        {totpError && <p className="text-sm text-destructive">{totpError}</p>}

        {totpPhase !== "verify" && (
          <button
            type="button"
            onClick={() => router.push(callbackURL)}
            className="text-sm font-medium text-foreground underline"
          >
            {totpPhase === "done" ? "Continue" : "Skip for now"}
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-32">
      <h1 className="text-xl font-semibold text-foreground">Create an account</h1>

      <form onSubmit={handleSignUp} className="flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-input px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Sign up
        </button>
      </form>

      {(authConfig.oauth.google || authConfig.oauth.github) && (
        <div className="flex flex-col gap-3">
          {authConfig.oauth.google && (
            <button
              type="button"
              onClick={() => handleSocialSignIn("google")}
              disabled={pending}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Sign up with Google
            </button>
          )}
          {authConfig.oauth.github && (
            <button
              type="button"
              onClick={() => handleSocialSignIn("github")}
              disabled={pending}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Sign up with GitHub
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={loginHref} className="font-medium text-foreground">
          Sign in
        </Link>
      </p>
    </main>
  );
}
