import { describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ approvals: [] as { email: string; newEmail: string }[], verifications: [] as string[] }));
vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: vi.fn(),
  sendVerifyEmail: async ({ email }: { email: string }) => void sent.verifications.push(email),
  sendChangeEmailApproval: async (a: { email: string; newEmail: string }) => void sent.approvals.push(a),
}));

import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { jsonRequest, signUpAndGetCookie } from "../../org/test-helpers";

const changeEmail = (cookie: string, newEmail: string) =>
  authPost(jsonRequest(`${APP_URL}/api/auth/change-email`, { method: "POST", cookie, body: { newEmail, callbackURL: "/account" } }));

describe("POST /api/auth/change-email", () => {
  it("requires a session", async () => {
    const response = await changeEmail("", `new-${crypto.randomUUID()}@example.com`);
    expect(response.status).toBe(401);
  });

  it("sends the new address a confirmation link while the old one is unverified", async () => {
    const { cookie, user } = await signUpAndGetCookie(`chg-${crypto.randomUUID()}@example.com`);
    const next = `new-${crypto.randomUUID()}@example.com`;
    const response = await changeEmail(cookie, next);
    expect(response.status).toBe(200);
    expect(sent.verifications).toContain(next);
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.email).toBe(user.email);
  });

  it("rate-limits repeated changes", async () => {
    const { cookie } = await signUpAndGetCookie(`chg-${crypto.randomUUID()}@example.com`);
    let last = 200;
    for (let i = 0; i < 6; i++) last = (await changeEmail(cookie, `new-${crypto.randomUUID()}@example.com`)).status;
    expect(last).toBe(429);
  });
});
