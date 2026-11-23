import { describe, expect, it } from "vitest";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { DELETE } from "./[sessionId]/route";
import { POST as revokeOthers } from "./revoke-others/route";
import { cookieHeaderFrom, jsonRequest, signUpAndGetCookie } from "@/app/api/org/test-helpers";
import { loadAccountSessions } from "@/core/account/sessions";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";

const BASE = `${APP_URL}/api/account/sessions`;

async function signIn(email: string) {
  const response = await authPost(
    new Request(`${APP_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (Windows NT 10.0) Firefox/127.0" },
      body: JSON.stringify({ email, password: "correcthorsebattery" }),
    }),
  );
  return cookieHeaderFrom(response);
}

async function sessionIds(userId: string) {
  const sessions = await (await auth.$context).internalAdapter.listSessions(userId);
  return sessions.map((session) => session.id);
}

const del = (id: string, cookie?: string) =>
  DELETE(jsonRequest(`${BASE}/${id}`, { method: "DELETE", cookie }), { params: Promise.resolve({ sessionId: id }) });

describe("account sessions", () => {
  it("requires authentication", async () => {
    expect((await del("x")).status).toBe(401);
    expect((await revokeOthers(jsonRequest(`${BASE}/revoke-others`, { method: "POST" }))).status).toBe(401);
  });

  it("lists the caller's sessions with the current one first and no tokens", async () => {
    const email = `sessions-list-${crypto.randomUUID()}@example.com`;
    const { cookie: first, user } = await signUpAndGetCookie(email);
    const second = await signIn(email);

    const headers = new Headers({ cookie: second });
    const current = (await sessionIds(user.id)).length;
    expect(current).toBe(2);

    const { auth } = await import("@/lib/auth");
    const currentId = (await auth.api.getSession({ headers }))!.session.id;
    const list = await loadAccountSessions(headers, currentId);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: currentId, current: true });
    expect(list[1].current).toBe(false);
    expect(JSON.stringify(list)).not.toContain("token");
    expect(first).not.toBe(second);
  });

  it("signs out another session but not the current one", async () => {
    const email = `sessions-revoke-${crypto.randomUUID()}@example.com`;
    const { cookie: first, user } = await signUpAndGetCookie(email);
    const second = await signIn(email);
    const { auth } = await import("@/lib/auth");
    const firstId = (await auth.api.getSession({ headers: new Headers({ cookie: first }) }))!.session.id;
    const secondId = (await auth.api.getSession({ headers: new Headers({ cookie: second }) }))!.session.id;

    expect((await del(secondId, second)).status).toBe(400);
    expect((await del(secondId, first)).status).toBe(204);
    expect(await sessionIds(user.id)).toEqual([firstId]);
  });

  it("returns 404 for another user's session and leaves it intact", async () => {
    const { cookie: attacker } = await signUpAndGetCookie(`sessions-a-${crypto.randomUUID()}@example.com`);
    const { user: victim } = await signUpAndGetCookie(`sessions-v-${crypto.randomUUID()}@example.com`);
    const [victimId] = await sessionIds(victim.id);

    expect((await del(victimId, attacker)).status).toBe(404);
    expect(await sessionIds(victim.id)).toEqual([victimId]);
  });

  it("signs out all other sessions and keeps the current one", async () => {
    const email = `sessions-others-${crypto.randomUUID()}@example.com`;
    const { cookie: first, user } = await signUpAndGetCookie(email);
    await signIn(email);
    await signIn(email);
    const { auth } = await import("@/lib/auth");
    const firstId = (await auth.api.getSession({ headers: new Headers({ cookie: first }) }))!.session.id;
    expect(await sessionIds(user.id)).toHaveLength(3);

    const response = await revokeOthers(jsonRequest(`${BASE}/revoke-others`, { method: "POST", cookie: first }));
    expect(response.status).toBe(204);
    expect(await sessionIds(user.id)).toEqual([firstId]);
  });

  it("leaves other users' sessions alone when signing out others", async () => {
    const { cookie } = await signUpAndGetCookie(`sessions-o1-${crypto.randomUUID()}@example.com`);
    const { user: other } = await signUpAndGetCookie(`sessions-o2-${crypto.randomUUID()}@example.com`);
    await revokeOthers(jsonRequest(`${BASE}/revoke-others`, { method: "POST", cookie }));
    expect(await sessionIds(other.id)).toHaveLength(1);
  });
});
