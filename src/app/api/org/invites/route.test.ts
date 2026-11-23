import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendOrgInviteEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";
import { jsonRequest, signUpAndGetCookie } from "../test-helpers";
import { POST as createOrg } from "../route";
import { APP_URL } from "@/lib/env";
import { addMember, deleteMember, getMembershipForOrg, listInvites } from "@/db/repo";
import { sendOrgInviteEmail } from "@/lib/email";

const INVITES_URL = `${APP_URL}/api/org/invites`;

async function createOrgAsOwner(name: string) {
  const email = `owner-${crypto.randomUUID()}@example.com`;
  const { cookie, user } = await signUpAndGetCookie(email);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name } }));
  const { organization } = await response.json();
  return { ownerCookie: cookie, ownerUser: user, organization };
}

describe("POST /api/org/invites", () => {
  beforeEach(() => {
    vi.mocked(sendOrgInviteEmail).mockClear();
  });

  it("requires authentication", async () => {
    const response = await POST(
      jsonRequest(INVITES_URL, { method: "POST", body: { email: "x@example.com", role: "member" } }),
    );
    expect(response.status).toBe(401);
  });

  it("requires the caller to belong to an organization", async () => {
    const { cookie } = await signUpAndGetCookie(`no-org-${crypto.randomUUID()}@example.com`);
    const response = await POST(
      jsonRequest(INVITES_URL, {
        method: "POST",
        cookie,
        body: { email: "x@example.com", role: "member" },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("lets an owner invite a new member and sends the invite email", async () => {
    const { ownerCookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const inviteEmail = `invitee-${crypto.randomUUID()}@example.com`;

    const response = await POST(
      jsonRequest(INVITES_URL, { method: "POST", cookie: ownerCookie, body: { email: inviteEmail, role: "member" } }),
    );
    expect(response.status).toBe(201);
    expect(sendOrgInviteEmail).toHaveBeenCalledTimes(1);
    expect(sendOrgInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: inviteEmail, orgName: organization.name }),
    );

    const invite = (await listInvites(organization.id)).find((row) => row.email === inviteEmail)!;
    expect(invite.orgId).toBe(organization.id);
    expect(invite.role).toBe("member");
    expect(invite.acceptedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a plain member (not owner/admin) inviting anyone", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    // Sign up the member first (gets both their id and a session cookie tied
    // to their real account in one step), then insert their membership row
    // directly — a real DB write, just faster to set up than a full
    // invite+accept round trip for a fixture this test doesn't otherwise
    // care about.
    const { cookie: memberCookie, user: memberUser } = await signUpAndGetCookie(
      `member-${crypto.randomUUID()}@example.com`,
    );
    await addMember({ orgId: organization.id, userId: memberUser.id, role: "member" });

    const response = await POST(
      jsonRequest(INVITES_URL, {
        method: "POST",
        cookie: memberCookie,
        body: { email: `nope-${crypto.randomUUID()}@example.com`, role: "member" },
      }),
    );
    expect(response.status).toBe(403);
    expect(sendOrgInviteEmail).not.toHaveBeenCalled();
  });

  it("rejects inviting someone who is already a member", async () => {
    const { ownerCookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { user: memberUser } = await signUpAndGetCookie(`already-member-${crypto.randomUUID()}@example.com`);
    await addMember({ orgId: organization.id, userId: memberUser.id, role: "member" });

    const response = await POST(
      jsonRequest(INVITES_URL, {
        method: "POST",
        cookie: ownerCookie,
        body: { email: memberUser.email, role: "member" },
      }),
    );
    expect(response.status).toBe(409);
  });

  it("rejects inviting someone as 'owner'", async () => {
    const { ownerCookie } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const response = await POST(
      jsonRequest(INVITES_URL, {
        method: "POST",
        cookie: ownerCookie,
        body: { email: `nope-${crypto.randomUUID()}@example.com`, role: "owner" },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("immediately loses access once the acting admin's membership row is removed, even with the same still-valid session cookie", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie, user: adminUser } = await signUpAndGetCookie(
      `admin-removed-${crypto.randomUUID()}@example.com`,
    );
    await addMember({ orgId: organization.id, userId: adminUser.id, role: "admin" });

    const before = await POST(
      jsonRequest(INVITES_URL, {
        method: "POST",
        cookie: adminCookie,
        body: { email: `before-removal-${crypto.randomUUID()}@example.com`, role: "member" },
      }),
    );
    expect(before.status).toBe(201);

    const removed = await getMembershipForOrg(adminUser.id, organization.id);
    await deleteMember(removed!.membership.id);

    const after = await POST(
      jsonRequest(INVITES_URL, {
        method: "POST",
        cookie: adminCookie,
        body: { email: `after-removal-${crypto.randomUUID()}@example.com`, role: "member" },
      }),
    );
    expect(after.status).toBe(404);
    expect(sendOrgInviteEmail).toHaveBeenCalledTimes(1);
  });

  it("refreshes rather than duplicates an existing pending invite to the same email", async () => {
    const { ownerCookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const inviteEmail = `refresh-${crypto.randomUUID()}@example.com`;

    const first = await POST(
      jsonRequest(INVITES_URL, { method: "POST", cookie: ownerCookie, body: { email: inviteEmail, role: "member" } }),
    );
    const firstBody = await first.json();

    const second = await POST(
      jsonRequest(INVITES_URL, { method: "POST", cookie: ownerCookie, body: { email: inviteEmail, role: "admin" } }),
    );
    const secondBody = await second.json();

    expect(firstBody.invite.id).toBe(secondBody.invite.id);
    expect(secondBody.invite.role).toBe("admin");

    const rows = (await listInvites(organization.id)).filter((row) => row.email === inviteEmail);
    expect(rows).toHaveLength(1);
  });
});
