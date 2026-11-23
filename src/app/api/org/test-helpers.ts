import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { APP_URL } from "@/lib/env";

/**
 * Shared by every `src/app/api/org/**` unit test below — all of them need
 * "sign up a real user, then drive a real authenticated request as them"
 * the same way `src/app/api/auth/[...all]/totp.test.ts` established. Not a
 * `.test.ts` file itself, so Vitest's default `*.test.*`/`*.spec.*` include
 * pattern never picks it up as a suite.
 */
export function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export async function signUpAndGetCookie(email: string, password = "correcthorsebattery", name = "Test User") {
  const response = await authPost(
    new Request(`${APP_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    }),
  );
  if (response.status !== 200) {
    throw new Error(`Sign-up failed for ${email}: ${await response.text()}`);
  }
  const cookie = cookieHeaderFrom(response);
  const { user } = await response.json();
  return { cookie, user: user as { id: string; email: string; name: string } };
}

export function jsonRequest(url: string, options: { method: string; cookie?: string; body?: unknown }) {
  return new Request(url, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}
