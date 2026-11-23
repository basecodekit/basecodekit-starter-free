import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendOrgInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";
import { POST as createOrg } from "../../../route";
import { POST as createInvite } from "../../route";
import { jsonRequest, signUpAndGetCookie } from "../../../test-helpers";
import { APP_URL } from "@/lib/env";
import { findInviteById, getMembershipForOrg, refreshInvite } from "@/db/repo";
import { sendOrgInviteEmail } from "@/lib/email";

async function createOrgAsOwner(name: string) {
  const { cookie, user } = await signUpAndGetCookie(`owner-${crypto.randomUUID()}@example.com`);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name } }));
  const { organization } = await response.json();
  return { ownerCookie: cookie, ownerUser: user, organization };
}

async function inviteEmail(ownerCookie: string, email: string, role: "admin" | "member" = "member") {
  const response = await createInvite(
    jsonRequest(`${APP_URL}/api/org/invites`, { method: "POST", cookie: ownerCookie, body: { email, role } }),
  );
  expect(response.status).toBe(201);
  const { invite } = await response.json();
  return (await findInviteById(invite.id))!;
}

function acceptUrl(token: string) {
  return `${APP_URL}/api/org/invites/${token}/accept`;
}

describe("POST /api/org/invites/[token]/accept", () => {
  beforeEach(() => {
    vi.mocked(sendOrgInviteEmail).mockClear();
  });

  it("requires authentication", async () => {
    const response = await POST(jsonRequest(acceptUrl("does-not-matter"), { method: "POST" }), {
      params: Promise.resolve({ token: "does-not-matter" }),
    });
    expect(response.status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    const { cookie } = await signUpAndGetCookie(`accept-unknown-${crypto.randomUUID()}@example.com`);
    const response = await POST(jsonRequest(acceptUrl("bogus-token"), { method: "POST", cookie }), {
      params: Promise.resolve({ token: "bogus-token" }),
    });
    expect(response.status).toBe(404);
  });

  it("accepts a valid invite, adding the invitee as a member with the invited role", async () => {
    const { ownerCookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const invitedEmail = `invitee-${crypto.randomUUID()}@example.com`;
    const invite = await inviteEmail(ownerCookie, invitedEmail, "admin");

    const { cookie: inviteeCookie, user: inviteeUser } = await signUpAndGetCookie(invitedEmail);

    const response = await POST(jsonRequest(acceptUrl(invite.token), { method: "POST", cookie: inviteeCookie }), {
      params: Promise.resolve({ token: invite.token }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.organizationId).toBe(organization.id);

    const membership = await getMembershipForOrg(inviteeUser.id, organization.id);
    expect(membership?.membership.role).toBe("admin");

    const acceptedInvite = await findInviteById(invite.id);
    expect(acceptedInvite?.acceptedAt).not.toBeNull();
  });

  it("rejects acceptance by a signed-in user whose email doesn't match the invite", async () => {
    const { ownerCookie } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const invite = await inviteEmail(ownerCookie, `invited-${crypto.randomUUID()}@example.com`);

    const { cookie: wrongUserCookie } = await signUpAndGetCookie(`wrong-user-${crypto.randomUUID()}@example.com`);
    const response = await POST(jsonRequest(acceptUrl(invite.token), { method: "POST", cookie: wrongUserCookie }), {
      params: Promise.resolve({ token: invite.token }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects reusing an already-accepted invite token", async () => {
    const { ownerCookie } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const invitedEmail = `reuse-${crypto.randomUUID()}@example.com`;
    const invite = await inviteEmail(ownerCookie, invitedEmail);
    const { cookie: inviteeCookie } = await signUpAndGetCookie(invitedEmail);

    const first = await POST(jsonRequest(acceptUrl(invite.token), { method: "POST", cookie: inviteeCookie }), {
      params: Promise.resolve({ token: invite.token }),
    });
    expect(first.status).toBe(200);

    const second = await POST(jsonRequest(acceptUrl(invite.token), { method: "POST", cookie: inviteeCookie }), {
      params: Promise.resolve({ token: invite.token }),
    });
    expect(second.status).toBe(410);
  });

  it("rejects an expired invite", async () => {
    const { ownerCookie } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const invitedEmail = `expired-${crypto.randomUUID()}@example.com`;
    const sent = await inviteEmail(ownerCookie, invitedEmail);
    const invite = await refreshInvite(sent.id, { role: sent.role, expiresAt: new Date(Date.now() - 1000).toISOString() });

    const { cookie: inviteeCookie } = await signUpAndGetCookie(invitedEmail);
    const response = await POST(jsonRequest(acceptUrl(invite.token), { method: "POST", cookie: inviteeCookie }), {
      params: Promise.resolve({ token: invite.token }),
    });
    expect(response.status).toBe(410);
  });
});
