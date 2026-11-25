import type { NextConfig } from "next";
import { siteConfig } from "./src/config/site.config";

// Static (no-nonce) CSP, per Next.js's own "Without Nonces" guidance
// (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
// A nonce-based CSP was deliberately not used here: it requires forcing
// every page into dynamic rendering (disables static optimization/ISR/PPR
// app-wide, see that same doc's "Static vs Dynamic Rendering" section) — a
// far bigger architectural tradeoff than this ticket's scope, and the ticket
// itself asks for this via `next.config.ts`'s `headers()`, not a proxy.
//
// `script-src`/`style-src` need `'unsafe-inline'` because the App Router
// injects inline scripts for the RSC payload stream (`self.__next_f.push`)
// and Next has no built-in way to hash/allowlist those without nonces.
// `'unsafe-eval'` is dev-only (React's dev-mode error-stack reconstruction
// uses `eval`; Next/React don't use it in production builds) — same
// isDev-gated pattern as the framework's own example.
const isDev = process.env.NODE_ENV === "development";

// A whitelabel logo hosted elsewhere (siteConfig.brand.logo.src as an
// https:// URL) needs its origin allowed for images, and only that origin.
// core/brand rejects any other non-path value at startup.
const logoSrc = siteConfig.brand?.logo?.src;
const logoOrigin = logoSrc?.startsWith("https://")
  ? new URL(logoSrc).origin
  : null;

// Uploaded org logos are served from the storage bucket's public URL.
const uploadsOrigin = process.env.R2_PUBLIC_URL?.startsWith("https://")
  ? new URL(process.env.R2_PUBLIC_URL).origin
  : null;
const r2AccountId = process.env.R2_ACCOUNT_ID ?? "";
const uploadsEndpoint = /^[0-9a-f]{32}$/.test(r2AccountId)
  ? `https://${r2AccountId}.r2.cloudflarestorage.com`
  : null;
const extraImgOrigins = [logoOrigin, uploadsOrigin].filter(Boolean).join(" ");

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // `data:` is required for the TOTP enrollment QR code, rendered client-side
  // via `qrcode`'s `toDataURL()` into an `<img src="data:...">` (see
  // `src/app/(auth)/signup/page.tsx`).
  `img-src 'self' data: blob:${extraImgOrigins ? ` ${extraImgOrigins}` : ""}`,
  "font-src 'self'",
  // The browser PUTs uploads straight to the bucket's S3 endpoint.
  `connect-src 'self'${uploadsEndpoint ? ` ${uploadsEndpoint}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Superseded by (but kept alongside, for older-browser fallback) the
  // `X-Frame-Options: DENY` header below — both express "never embeddable".
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
];

// Note on what's deliberately NOT here: no `Permissions-Policy`. This app's
// passkey (WebAuthn) flows depend on the `publickey-credentials-get`/
// `-create` permissions being available, and a hand-rolled Permissions-Policy
// is an easy way to silently disable those for embedded/cross-origin
// contexts without a corresponding e2e regression catching it. Table-stakes
// headers only, per the ticket's own "don't gold-plate" instruction.
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No `includeSubDomains`/`preload`: this codebase is resold as a
  // boilerplate, and a buyer's other subdomains aren't guaranteed to be
  // HTTPS-ready. Browsers ignore this header entirely on plain-HTTP
  // responses (dev), so it's safe to send unconditionally.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  // The Dockerfile sets this to get a self-contained server with only the
  // files it needs. Left off otherwise, since `next start` warns with it on.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
