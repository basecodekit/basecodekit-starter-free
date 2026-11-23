# BasecodeKit starter

A Next.js SaaS starter: email/password, magic-link, passkey, 2FA and OAuth sign-in (Better Auth), organizations with roles and invites, a config-driven landing page, and a dashboard.

## Getting started

You need [Bun](https://bun.sh), Node 22.13+ and Docker (for the local Postgres). The commands below use Bun; with another package manager, use its equivalents. `create-basecodekit` printed the exact list for your project when it finished, and that list is the one to follow.

```bash
bun install
docker compose up -d         # Postgres on localhost:5434
bunx auth@latest migrate -y  # Drizzle projects only: Better Auth's tables
bun run db:migrate           # the app's tables
bun run dev                  # http://localhost:3355
```

`.env` was created for you with a random `BETTER_AUTH_SECRET` and the local database URL, so sign-up with a password works straight away. Everything else is optional and turns on when you fill it in:

| Variables | Turns on |
| --- | --- |
| `RESEND_API_KEY`, `EMAIL_FROM` | Magic links, invites, email-change confirmation |
| `GOOGLE_CLIENT_ID` / `_SECRET`, `GITHUB_CLIENT_ID` / `_SECRET` | OAuth sign-in |
| `R2_*` | Logo and avatar uploads (Cloudflare R2) |
| `SENTRY_DSN` | Error alerts |

`.env.example` documents every variable. Without `RESEND_API_KEY`, anything that sends an email (magic links, invites) fails with an error. A free Resend key with the default `onboarding@resend.dev` sender is enough locally, but that sender only delivers to your own Resend account's address.

Optional: `bun run db:seed` creates a demo organization and its owner, who signs in as `owner@example.com` / `seed-owner-password-1!`.

## Where things live

- `src/app/`: routes (landing page, auth pages, dashboard, API).
- `src/config/`: what you edit first. `landing.config.ts` holds the landing page copy, `layout.config.ts` the layout and style pack, `auth.config.ts` the sign-in methods.
- `src/db/`: schema, migrations and the data-access functions (`repo`).
- `src/lib/`: auth, email, env and shared helpers.

## Passkeys / WebAuthn RP ID

Passkey sign-in (`@better-auth/passkey`, wired in `src/lib/auth.ts`, enabled via `authConfig.passkeys` in `src/config/auth.config.ts`) is bound to a **WebAuthn Relying Party ID (RP ID)** — the domain a passkey is registered against. This app derives the RP ID automatically from `APP_URL`/`BETTER_AUTH_URL` (`new URL(APP_URL).hostname`), and passes `origin: APP_URL` to the plugin so registration/authentication ceremonies are validated against the exact scheme+host+port the app is actually served from.

**This must be reconfigured correctly per environment — it does not "just work" across environments by itself:**

- **Dev:** `BETTER_AUTH_URL=http://localhost:3355` → RP ID `localhost`. This is the default and needs no changes locally.
- **Staging:** `BETTER_AUTH_URL` must be set to staging's real origin (e.g. `https://staging.yourapp.com`) → RP ID becomes `staging.yourapp.com`.
- **Production:** `BETTER_AUTH_URL` must be set to production's real origin (e.g. `https://yourapp.com`) → RP ID becomes `yourapp.com`.

**Why this matters, concretely:** a passkey is cryptographically scoped to the RP ID it was registered under. A passkey a user registers while the app is served from `staging.yourapp.com` will **not** authenticate them once the app moves to `yourapp.com` (or any other domain/subdomain) — the browser will not even offer it as a candidate credential. There is no automatic migration path for this; if you rename/move domains after passkeys are already in production use, existing users' passkeys stop working and they must re-enroll (fall back to password/magic-link/OAuth, then add a new passkey under the new RP ID).

Two more RP ID/WebAuthn constraints worth knowing when configuring this per environment:
- The RP ID must be the origin's hostname exactly, or a *registrable domain suffix* of it (e.g. RP ID `yourapp.com` is valid for an app served from `app.yourapp.com`, but `yourapp.com` is never valid for an app served from a completely different domain). It can never include a scheme or port.
- WebAuthn requires a secure context — `https://` in every environment except `http://localhost`. Staging/production must be served over HTTPS for passkeys to work at all.

## Landing page and design system

The home page is rendered from config, never edited directly:

- **`src/config/layout.config.ts`** — `archetype` picks the page structure and `stylePack` the look, app-wide; the file lists the options.
- **`src/config/landing.config.ts`** — every word on the landing page.

Styling goes through semantic tokens only (`bg-background`, `text-muted-foreground`, `bg-primary`, …, defined in `src/app/globals.css`); a style pack (`src/styles/packs/`) is just a set of variable overrides. A test fails if a component uses a raw palette color like `text-zinc-600`, so packs can always restyle everything. Motion is per pack (`src/core/layout/motion-presets.ts`): a pack either reveals content on scroll or stays still, and visitors who prefer reduced motion get fades only.

## Error alerts (Sentry)

**Sentry** is server-side only and off until `SENTRY_DSN` is set (`src/instrumentation.ts`). With it set, unhandled server errors, `reportAlert()` calls (`src/lib/monitoring.ts`) and cron check-ins go to Sentry; without it they're still logged. Set `SENTRY_ENVIRONMENT` per deploy (`staging`, `production`) so alerts are told apart.

## Deploy

It is a standard Next.js app (`bun run build`, then `bun run start`), so it runs on Vercel or on any server that runs Node or Docker. On each environment:

1. Create a Postgres database and set `DATABASE_URL`.
2. Set `BETTER_AUTH_URL` to the public origin, e.g. `https://yourapp.com`. Production refuses to start without it, and passkeys are tied to it (see above).
3. Set a new `BETTER_AUTH_SECRET` (`openssl rand -base64 32`); never reuse the dev one.
4. Run the migrations against that database before the first start.
5. Set `RESEND_API_KEY` and an `EMAIL_FROM` on a domain verified in Resend, plus any OAuth, R2 and Sentry variables you use. OAuth apps need the production callback URL `https://yourapp.com/api/auth/callback/<provider>`.
6. Serve it over HTTPS.
