import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { authConfig } from "@/config/auth.config";

/**
 * Pulls the session cookie back out of a Better Auth response so it can be
 * forwarded on the next request in the same flow — these tests drive the
 * real `/api/auth/*` routes end to end (sign-up -> enable -> verify), the
 * same way the rest of this directory's tests exercise `route.ts` directly
 * rather than mocking Better Auth's internals.
 */
function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/**
 * Minimal RFC 4648 base32 decoder (no padding). Better Auth's TOTP URI
 * builder (`@better-auth/utils`'s `generateQRCode`, called from the
 * `two-factor` plugin's `enable`/`getTOTPURI` endpoints) base32-encodes the
 * raw secret into the URI's `secret` query param for authenticator apps to
 * scan, but — confirmed by reading `@better-auth/utils/dist/otp.mjs` and
 * `better-auth/dist/plugins/two-factor/totp/index.mjs` directly — neither
 * `auth.api.generateTOTP` nor the `/two-factor/verify-totp` endpoint ever
 * base32-decodes it back on this server: both use the *raw* secret string
 * as the HMAC key directly. Decoding here recovers that raw secret from the
 * URI (the same computation a real authenticator app performs after
 * scanning the QR code), so a valid code can be generated for the actual
 * enrolled secret without reading it out of the database.
 */
function base32Decode(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

describe.skipIf(!authConfig.totpMfa)("TOTP MFA (two-factor plugin)", () => {
  it("enrolls a user, then /two-factor/verify-totp rejects a wrong code and accepts the real one", async () => {
    const email = `totp-unit-${crypto.randomUUID()}@example.com`;
    const password = "correcthorsebattery";

    const signUpResponse = await POST(
      new Request(`${APP_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name: "TOTP Unit Test" }),
      }),
    );
    expect(signUpResponse.status).toBe(200);
    const sessionCookie = cookieHeaderFrom(signUpResponse);
    expect(sessionCookie).not.toBe("");

    const enableResponse = await POST(
      new Request(`${APP_URL}/api/auth/two-factor/enable`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({ password, method: "totp" }),
      }),
    );
    expect(enableResponse.status).toBe(200);
    const enableBody = await enableResponse.json();
    expect(enableBody.method).toBe("totp");
    expect(typeof enableBody.totpURI).toBe("string");
    expect(Array.isArray(enableBody.backupCodes)).toBe(true);
    expect(enableBody.backupCodes.length).toBeGreaterThan(0);

    const encodedSecret = new URL(enableBody.totpURI).searchParams.get("secret");
    expect(encodedSecret).toBeTruthy();
    const rawSecret = base32Decode(encodedSecret as string);

    // The known secret/code pair: `generateTOTP` is the same server-only
    // endpoint (`auth.api.generateTOTP`) the two-factor plugin exposes for
    // this exact purpose (see `dist/plugins/two-factor/totp/index.d.mts`),
    // called here directly rather than pulling in a separate TOTP library.
    const { code } = await auth.api.generateTOTP({ body: { secret: rawSecret } });
    expect(code).toMatch(/^\d{6}$/);

    // Reject a wrong code first, while the session captured above is still
    // valid — a successful verify below rotates the session (Better Auth
    // issues a fresh session once 2FA is confirmed), so asserting the
    // rejection case afterward would need the rotated cookie instead.
    const wrongCode = code[0] === "0" ? `9${code.slice(1)}` : `0${code.slice(1)}`;
    const rejectedResponse = await POST(
      new Request(`${APP_URL}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({ code: wrongCode }),
      }),
    );
    expect(rejectedResponse.status).toBe(401);

    const verifyResponse = await POST(
      new Request(`${APP_URL}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie },
        body: JSON.stringify({ code }),
      }),
    );
    expect(verifyResponse.status).toBe(200);

    // Verifying flips `twoFactorEnabled` on the persisted user and rotates
    // the session (Better Auth issues a fresh session once 2FA is
    // confirmed — see `dist/plugins/two-factor/totp/index.mjs`), but the
    // `verify-totp` response body's own `user` field is a stale snapshot
    // captured before that update runs, so it doesn't reflect it. Confirm
    // the real persisted state instead via `get-session` with the rotated
    // cookie from the verify response.
    const rotatedCookie = cookieHeaderFrom(verifyResponse);
    expect(rotatedCookie).not.toBe("");
    const sessionResponse = await GET(
      new Request(`${APP_URL}/api/auth/get-session`, {
        headers: { cookie: rotatedCookie },
      }),
    );
    const sessionBody = await sessionResponse.json();
    expect(sessionBody.user.twoFactorEnabled).toBe(true);
  });
});
