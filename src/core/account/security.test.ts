import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/[...all]/route";
import { loadAccountSecurity } from "./security";
import { APP_URL } from "@/lib/env";
import { authConfig } from "@/config/auth.config";

async function signUp() {
  const response = await POST(
    new Request(`${APP_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `account-security-${crypto.randomUUID()}@example.com`,
        password: "correcthorsebattery",
        name: "Account Security",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { userId: body.user.id as string, headers: new Headers({ cookie }) };
}

describe("loadAccountSecurity", () => {
  it("reports a password login and no two-factor for a fresh email/password user", async () => {
    const { userId, headers } = await signUp();
    expect(await loadAccountSecurity(headers, userId)).toEqual({
      hasPassword: true,
      totpAvailable: authConfig.totpMfa,
      twoFactorEnabled: false,
    });
  });

  it("never reports two-factor as enabled for a user id other than the session's", async () => {
    const { headers } = await signUp();
    const result = await loadAccountSecurity(headers, "someone-else");
    expect(result.twoFactorEnabled).toBe(false);
  });
});
