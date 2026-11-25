import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { magicLink, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { authConfig } from "@/config/auth.config";
import { siteConfig } from "@/config/site.config";
import { sendChangeEmailApproval, sendMagicLinkEmail, sendVerifyEmail } from "@/lib/email";
import { authPool } from "@/lib/auth-pool";
import { checkRateLimit } from "@/lib/rate-limit";
import { APP_URL } from "@/lib/env";

const MAGIC_LINK_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };
const CHANGE_EMAIL_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 };
const MAX_NAME_LENGTH = 200;

/**
 * WebAuthn RP ID (Relying Party ID) — the domain a passkey is bound to.
 * Derived from `APP_URL` (the single source of truth for this app's base
 * URL, see `@/lib/env`) rather than hardcoded, so it always matches
 * whatever origin the app is actually served from. See `README.md`'s
 * "Passkeys / WebAuthn RP ID" section for why this MUST be reconfigured
 * per environment (dev/staging/prod) and cannot just follow `APP_URL`
 * automatically once you deploy — a passkey registered under one RP ID
 * will not authenticate against a different one.
 */
const PASSKEY_RP_ID = new URL(APP_URL).hostname;

export const auth = betterAuth({
  baseURL: APP_URL,
  // Better Auth defaults `appName` to "Better Auth" if unset. The two-factor
  // plugin's `getTOTPURI` endpoint (used to re-derive a TOTP URI outside the
  // initial `enable()` call) falls back to this value as the QR code
  // "issuer" label whenever no per-call issuer is supplied, so it must be
  // set explicitly to the site's own name for that label to be consistent
  // with the issuer `twoFactor()` below uses on initial enrollment.
  appName: siteConfig.name,
  database: authPool,
  // Better Auth limits sign-in, sign-up and password reset per client IP in
  // production. Its default store is in memory, which each serverless
  // instance keeps separately; the `rateLimit` table is shared by all of them.
  rateLimit: {
    storage: "database",
  },
  emailAndPassword: {
    enabled: authConfig.emailPassword,
  },
  // Only sent when the account changes its email address (no
  // `sendOnSignUp`): the link goes to the new address.
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerifyEmail({ email: user.email, url });
    },
  },
  user: {
    // A verified address is first approved from the old one, then
    // confirmed from the new one; the email only changes after both.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendChangeEmailApproval({ email: user.email, newEmail, url });
      },
    },
  },
  socialProviders: {
    ...(authConfig.oauth.google
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {}),
    ...(authConfig.oauth.github
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
          },
        }
      : {}),
  },
  plugins: [
    ...(authConfig.magicLink
      ? [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              await sendMagicLinkEmail({ email, url });
            },
          }),
        ]
      : []),
    ...(authConfig.passkeys
      ? [
          passkey({
            rpID: PASSKEY_RP_ID,
            rpName: "BaseCodeKit",
            origin: APP_URL,
          }),
        ]
      : []),
    ...(authConfig.totpMfa
      ? [
          twoFactor({
            issuer: siteConfig.name,
            totpOptions: {
              digits: 6,
              period: 30,
              // `storeBackupCodes` intentionally left at the plugin default
              // ("encrypted", set inside `twoFactor()` itself, not "plain")
              // — see the security note below.
            },
            // Security: the plugin's own defaults already satisfy this
            // ticket's requirements without any extra config here —
            // verified directly against the installed
            // `better-auth@1.7.3` source (`dist/plugins/two-factor/index.mjs`):
            //   - The TOTP secret is `symmetricEncrypt`-ed before being
            //     written to the `twoFactor` table (never stored plaintext).
            //   - `backupCodeOptions.storeBackupCodes` defaults to
            //     `"encrypted"` (not `"plain"`) unless overridden — not
            //     overridden here.
            // Note the ticket's checklist phrase "recovery codes hashed" is
            // technically imprecise for what this library does: it's
            // reversible *encryption*, not one-way hashing, because the
            // plugin also exposes a server-only `viewBackupCodes` endpoint
            // that reads codes back — true hashing would break that. Using
            // the library's built-in "encrypted" storage (not plaintext,
            // not hand-rolled) is the right call; see the pipeline log for
            // the full reasoning.
          }),
        ]
      : []),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/update-user") {
        // The avatar goes through `/api/account/profile/avatar`, which
        // checks the uploaded file; a free-form URL here would let anyone
        // point `image` at a page they control.
        if (ctx.body && "image" in ctx.body) {
          throw new APIError("BAD_REQUEST", { message: "Use the avatar upload to change the picture." });
        }
        if (typeof ctx.body?.name === "string" && ctx.body.name.trim().length > MAX_NAME_LENGTH) {
          throw new APIError("BAD_REQUEST", { message: `Name must be at most ${MAX_NAME_LENGTH} characters.` });
        }
        return;
      }

      if (ctx.path === "/change-email") {
        const session = await getSessionFromCtx(ctx);
        if (!session) return;
        if (!(await checkRateLimit(`change-email:${session.user.id}`, CHANGE_EMAIL_RATE_LIMIT.windowMs, CHANGE_EMAIL_RATE_LIMIT.max))) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Too many email changes. Try again later." });
        }
        return;
      }

      if (ctx.path !== "/sign-in/magic-link") return;

      const email = typeof ctx.body?.email === "string" ? ctx.body.email.toLowerCase() : undefined;
      if (!email) return;

      const allowed = await checkRateLimit(
        `magic-link:${email}`,
        MAGIC_LINK_RATE_LIMIT.windowMs,
        MAGIC_LINK_RATE_LIMIT.max,
      );
      if (!allowed) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: "Too many magic link requests for this email. Try again later.",
        });
      }
    }),
  },
});
