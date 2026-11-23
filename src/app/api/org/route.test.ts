import { describe, expect, it } from "vitest";
import { DELETE, POST } from "./route";
import { jsonRequest, signUpAndGetCookie } from "./test-helpers";
import { APP_URL } from "@/lib/env";
import { addMember, createInvite, findOrganizationById, getMembershipForOrg, listInvites } from "@/db/repo";

const ORG_URL = `${APP_URL}/api/org`;

describe("POST /api/org", () => {
  it("requires authentication", async () => {
    const response = await POST(jsonRequest(ORG_URL, { method: "POST", body: { name: "Acme" } }));
    expect(response.status).toBe(401);
  });

  it("creates an organization plus an owner membership for a user with no org", async () => {
    const email = `org-create-${crypto.randomUUID()}@example.com`;
    const { cookie, user } = await signUpAndGetCookie(email);

    const response = await POST(jsonRequest(ORG_URL, { method: "POST", cookie, body: { name: "Acme Inc" } }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.organization.name).toBe("Acme Inc");
    expect(body.organization.ownerUserId).toBe(user.id);

    const membership = await getMembershipForOrg(user.id, body.organization.id);
    expect(membership?.membership.role).toBe("owner");
  });

  it("rejects creating a second organization for a user who already belongs to one", async () => {
    const email = `org-create-twice-${crypto.randomUUID()}@example.com`;
    const { cookie } = await signUpAndGetCookie(email);

    const first = await POST(jsonRequest(ORG_URL, { method: "POST", cookie, body: { name: "First Org" } }));
    expect(first.status).toBe(201);

    const second = await POST(jsonRequest(ORG_URL, { method: "POST", cookie, body: { name: "Second Org" } }));
    expect(second.status).toBe(409);
  });

  it("rejects a blank organization name", async () => {
    const email = `org-create-blank-${crypto.randomUUID()}@example.com`;
    const { cookie } = await signUpAndGetCookie(email);

    const response = await POST(jsonRequest(ORG_URL, { method: "POST", cookie, body: { name: "   " } }));
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/org", () => {
  async function createOrgAsOwner(name: string) {
    const { cookie, user } = await signUpAndGetCookie(`owner-${crypto.randomUUID()}@example.com`);
    const response = await POST(jsonRequest(ORG_URL, { method: "POST", cookie, body: { name } }));
    const { organization } = await response.json();
    return { cookie, user, organization };
  }

  function deleteAs(cookie: string | undefined, confirmName?: string) {
    return DELETE(jsonRequest(ORG_URL, { method: "DELETE", cookie, body: { confirmName } }));
  }

  it("requires authentication", async () => {
    expect((await deleteAs(undefined, "Acme")).status).toBe(401);
  });

  it("is for the owner only", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie, user: admin } = await signUpAndGetCookie(`admin-${crypto.randomUUID()}@example.com`);
    await addMember({ orgId: organization.id, userId: admin.id, role: "admin" });

    expect((await deleteAs(adminCookie, organization.name)).status).toBe(403);
    expect(await findOrganizationById(organization.id)).not.toBeNull();
  });

  it("requires the org's name, typed exactly", async () => {
    const { cookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);

    expect((await deleteAs(cookie)).status).toBe(400);
    expect((await deleteAs(cookie, "acme")).status).toBe(400);
    expect(await findOrganizationById(organization.id)).not.toBeNull();
  });

  it("deletes the org with its members and invites, and keeps the users", async () => {
    const { cookie, user, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { user: member } = await signUpAndGetCookie(`member-${crypto.randomUUID()}@example.com`);
    await addMember({ orgId: organization.id, userId: member.id, role: "member" });
    await createInvite({
      orgId: organization.id,
      email: `invitee-${crypto.randomUUID()}@example.com`,
      role: "member",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      invitedByUserId: user.id,
    });

    expect((await deleteAs(cookie, organization.name)).status).toBe(204);

    expect(await findOrganizationById(organization.id)).toBeNull();
    expect(await getMembershipForOrg(member.id, organization.id)).toBeNull();
    expect(await listInvites(organization.id)).toEqual([]);
    // The owner can start over with a new org.
    const again = await POST(jsonRequest(ORG_URL, { method: "POST", cookie, body: { name: "Fresh start" } }));
    expect(again.status).toBe(201);
  });

});
