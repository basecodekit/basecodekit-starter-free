"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { authConfig } from "@/config/auth.config";
import { SIGNED_IN_HOME, safeCallbackURL } from "@/lib/safe-redirect";

export function LoginForm() {
  // `useSearchParams` requires a `Suspense` boundary above it in the App
  // Router — this page has no server-fetched data of its own to suspend on,
  // so the fallback below is effectively never shown in practice.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lets a page like `/invite/[token]` send an unauthenticated visitor here
  // (`/login?callbackURL=/invite/abc123`) and land back on the invite after
  // signing in. Only same-origin paths are honored (open-redirect guard);
  // anything else, or none, lands on the dashboard.
  const callbackURL = safeCallbackURL(searchParams.get("callbackURL"));
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const signupQuery = new URLSearchParams();
  if (callbackURL !== SIGNED_IN_HOME) signupQuery.set("callbackURL", callbackURL);
  if (email) signupQuery.set("email", email);
  const signupHref = signupQuery.size > 0 ? `/signup?${signupQuery.toString()}` : "/signup";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [pending, setPending] = useState(false);

  // Set once primary sign-in (email/password) succeeds but the account has
  // TOTP MFA enabled — Better Auth's `twoFactor` plugin intercepts
  // `/sign-in/email` via a server-side `hooks.after` and, instead of
  // completing the session, deletes the just-created session and returns
  // `{ twoFactorRedirect: true, twoFactorMethods: [...] }` in its place
  // (confirmed directly against the installed `better-auth@1.7.3` source,
  // `dist/plugins/two-factor/index.mjs`). That shape is NOT reflected in
  // `signIn.email()`'s static return type (it's added by a plugin hook, not
  // the endpoint's own declared response), so it has to be checked at
  // runtime rather than relied on statically.
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { data, error: signInError } = await authClient.signIn.email({ email, password });

    setPending(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign in.");
      return;
    }

    // `data`'s static type only describes a completed sign-in (see the note
    // above the state declarations) — cast to check for the plugin-added
    // shape actually returned at runtime instead of trusting the static type.
    const twoFactorRedirect = (data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect ?? false;
    if (twoFactorRedirect) {
      setTwoFactorPending(true);
      return;
    }
    router.push(callbackURL);
  }

  async function handleTwoFactorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTwoFactorError(null);
    setPending(true);

    const { error: verifyError } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code: twoFactorCode })
      : await authClient.twoFactor.verifyTotp({ code: twoFactorCode });

    setPending(false);
    if (verifyError) {
      setTwoFactorError(verifyError.message ?? "That code didn't work.");
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
      setError(socialError.message ?? `Could not sign in with ${provider}.`);
    }
  }

  async function handlePasskeySignIn() {
    setError(null);
    setPending(true);

    const { error: passkeyError } = await authClient.signIn.passkey();

    setPending(false);
    if (passkeyError) {
      setError(passkeyError.message ?? "Could not sign in with a passkey.");
      return;
    }
    router.push(callbackURL);
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setError(null);
    setPending(true);

    const { error: magicLinkError } = await authClient.signIn.magicLink({
      email,
      callbackURL,
    });

    setPending(false);
    if (magicLinkError) {
      setError(magicLinkError.message ?? "Could not send magic link.");
      return;
    }
    setMagicLinkSent(true);
  }

  if (twoFactorPending) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-32">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Two-factor verification
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {useBackupCode
              ? "Enter one of your unused backup codes."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>

        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            autoFocus
            inputMode={useBackupCode ? "text" : "numeric"}
            placeholder={useBackupCode ? "Backup code" : "6-digit code"}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            className="rounded-md border border-input px-3 py-2 text-center text-sm tracking-widest"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Verify
          </button>
        </form>

        {twoFactorError && <p className="text-sm text-destructive">{twoFactorError}</p>}

        <button
          type="button"
          onClick={() => {
            setUseBackupCode((prev) => !prev);
            setTwoFactorCode("");
            setTwoFactorError(null);
          }}
          className="text-sm font-medium text-foreground underline"
        >
          {useBackupCode ? "Use your authenticator app instead" : "Use a backup code instead"}
        </button>
      </main>
    );
  }

  if (magicLinkSent) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-32 text-center">
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to {email}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-32">
      <h1 className="text-xl font-semibold text-foreground">Sign in</h1>

      {authConfig.emailPassword && (
        <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-3">
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
            Sign in
          </button>
        </form>
      )}

      {authConfig.magicLink && (
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={pending}
          className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          Email me a sign-in link
        </button>
      )}

      {authConfig.passkeys && (
        <button
          type="button"
          onClick={handlePasskeySignIn}
          disabled={pending}
          className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          Sign in with a passkey
        </button>
      )}

      {(authConfig.oauth.google || authConfig.oauth.github) && (
        <div className="flex flex-col gap-3">
          {authConfig.oauth.google && (
            <button
              type="button"
              onClick={() => handleSocialSignIn("google")}
              disabled={pending}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Sign in with Google
            </button>
          )}
          {authConfig.oauth.github && (
            <button
              type="button"
              onClick={() => handleSocialSignIn("github")}
              disabled={pending}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Sign in with GitHub
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={signupHref} className="font-medium text-foreground">
          Sign up
        </Link>
      </p>
    </main>
  );
}
