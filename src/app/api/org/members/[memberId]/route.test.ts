import { describe, expect, it } from "vitest";
import { DELETE, PATCH } from "./route";
import { POST as createOrg } from "../../route";
import { jsonRequest, signUpAndGetCookie } from "../../test-helpers";
import { APP_URL } from "@/lib/env";
import * as repo from "@/db/repo";

async function createOrgAsOwner(name: string) {
  const { cookie, user } = await signUpAndGetCookie(`owner-${crypto.randomUUID()}@example.com`);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name } }));
  const { organization } = await response.json();
  const ownerMembership = (await repo.getMembershipForOrg(user.id, organization.id))!.membership;
  return { ownerCookie: cookie, ownerUser: user, organization, ownerMembership };
}

/** Directly inserts a membership row — a real DB write, just faster than a
 * full invite+accept round trip for fixtures these tests don't otherwise
 * exercise. */
async function addMember(orgId: string, role: "admin" | "member") {
  const { cookie, user } = await signUpAndGetCookie(`member-${crypto.randomUUID()}@example.com`);
  const membership = await repo.addMember({ orgId, userId: user.id, role });
  return { cookie, user, membership };
}

function membersUrl(memberId: string) {
  return `${APP_URL}/api/org/members/${memberId}`;
}

describe("PATCH /api/org/members/[memberId]", () => {
  it("requires authentication", async () => {
    const response = await PATCH(jsonRequest(membersUrl("does-not-matter"), { method: "PATCH", body: { role: "admin" } }), {
      params: Promise.resolve({ memberId: "does-not-matter" }),
    });
    expect(response.status).toBe(401);
  });

  it("lets an owner promote a member to admin", async () => {
    const { ownerCookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { membership } = await addMember(organization.id, "member");

    const response = await PATCH(
      jsonRequest(membersUrl(membership.id), { method: "PATCH", cookie: ownerCookie, body: { role: "admin" } }),
      { params: Promise.resolve({ memberId: membership.id }) },
    );
    expect(response.status).toBe(200);

    const updated = await repo.findMemberById(membership.id);
    expect(updated?.role).toBe("admin");
  });

  it("rejects a plain member changing anyone's role", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { membership: targetMembership } = await addMember(organization.id, "member");
    const { cookie: actingMemberCookie } = await addMember(organization.id, "member");

    const response = await PATCH(
      jsonRequest(membersUrl(targetMembership.id), {
        method: "PATCH",
        cookie: actingMemberCookie,
        body: { role: "admin" },
      }),
      { params: Promise.resolve({ memberId: targetMembership.id }) },
    );
    expect(response.status).toBe(403);
  });

  it("never allows setting a role to 'owner'", async () => {
    const { ownerCookie, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { membership } = await addMember(organization.id, "member");

    const response = await PATCH(
      jsonRequest(membersUrl(membership.id), { method: "PATCH", cookie: ownerCookie, body: { role: "owner" } }),
      { params: Promise.resolve({ memberId: membership.id }) },
    );
    expect(response.status).toBe(400);
  });

  it("refuses to change the owner's own membership row, even via another admin", async () => {
    const { ownerMembership, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie } = await addMember(organization.id, "admin");

    const response = await PATCH(
      jsonRequest(membersUrl(ownerMembership.id), { method: "PATCH", cookie: adminCookie, body: { role: "member" } }),
      { params: Promise.resolve({ memberId: ownerMembership.id }) },
    );
    expect(response.status).toBe(403);
  });

  it("treats a memberId belonging to a different org as not found (no cross-tenant leakage)", async () => {
    const { ownerCookie: org1OwnerCookie } = await createOrgAsOwner(`Org One ${crypto.randomUUID()}`);
    const { organization: org2 } = await createOrgAsOwner(`Org Two ${crypto.randomUUID()}`);
    const { membership: org2Member } = await addMember(org2.id, "member");

    const response = await PATCH(
      jsonRequest(membersUrl(org2Member.id), { method: "PATCH", cookie: org1OwnerCookie, body: { role: "admin" } }),
      { params: Promise.resolve({ memberId: org2Member.id }) },
    );
    expect(response.status).toBe(404);

    const unchanged = await repo.findMemberById(org2Member.id);
    expect(unchanged?.role).toBe("member");
  });

  it("immediately loses access once the acting admin's own membership row is removed, even with the same still-valid session cookie", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie, user: adminUser } = await addMember(organization.id, "admin");
    const { membership: targetMembership } = await addMember(organization.id, "member");

    const before = await PATCH(
      jsonRequest(membersUrl(targetMembership.id), { method: "PATCH", cookie: adminCookie, body: { role: "admin" } }),
      { params: Promise.resolve({ memberId: targetMembership.id }) },
    );
    expect(before.status).toBe(200);

    await repo.deleteMember((await repo.getMembershipForOrg(adminUser.id, organization.id))!.membership.id);

    const after = await PATCH(
      jsonRequest(membersUrl(targetMembership.id), { method: "PATCH", cookie: adminCookie, body: { role: "member" } }),
      { params: Promise.resolve({ memberId: targetMembership.id }) },
    );
    expect(after.status).toBe(404);

    const unchanged = await repo.findMemberById(targetMembership.id);
    expect(unchanged?.role).toBe("admin");
  });
});

describe("DELETE /api/org/members/[memberId]", () => {
  it("lets an admin remove a plain member", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie } = await addMember(organization.id, "admin");
    const { membership: targetMembership } = await addMember(organization.id, "member");

    const response = await DELETE(jsonRequest(membersUrl(targetMembership.id), { method: "DELETE", cookie: adminCookie }), {
      params: Promise.resolve({ memberId: targetMembership.id }),
    });
    expect(response.status).toBe(204);

    const member = await repo.findMemberById(targetMembership.id);
    expect(member).toBeNull();
  });

  it("never allows removing the owner", async () => {
    const { ownerCookie, ownerMembership } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);

    const response = await DELETE(
      jsonRequest(membersUrl(ownerMembership.id), { method: "DELETE", cookie: ownerCookie }),
      { params: Promise.resolve({ memberId: ownerMembership.id }) },
    );
    expect(response.status).toBe(403);

    const member = await repo.findMemberById(ownerMembership.id);
    expect(member).not.toBeNull();
  });

  it("rejects a plain member removing anyone", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { membership: targetMembership } = await addMember(organization.id, "member");
    const { cookie: actingMemberCookie } = await addMember(organization.id, "member");

    const response = await DELETE(
      jsonRequest(membersUrl(targetMembership.id), { method: "DELETE", cookie: actingMemberCookie }),
      { params: Promise.resolve({ memberId: targetMembership.id }) },
    );
    expect(response.status).toBe(403);
  });

  it("treats a memberId belonging to a different org as not found (no cross-tenant leakage)", async () => {
    const { ownerCookie: org1OwnerCookie } = await createOrgAsOwner(`Org One ${crypto.randomUUID()}`);
    const { organization: org2 } = await createOrgAsOwner(`Org Two ${crypto.randomUUID()}`);
    const { membership: org2Member } = await addMember(org2.id, "member");

    const response = await DELETE(
      jsonRequest(membersUrl(org2Member.id), { method: "DELETE", cookie: org1OwnerCookie }),
      { params: Promise.resolve({ memberId: org2Member.id }) },
    );
    expect(response.status).toBe(404);

    const member = await repo.findMemberById(org2Member.id);
    expect(member).not.toBeNull();
  });

  it("immediately loses access once the acting admin's own membership row is removed, even with the same still-valid session cookie", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie, user: adminUser } = await addMember(organization.id, "admin");
    const { membership: targetMembership } = await addMember(organization.id, "member");

    await repo.deleteMember((await repo.getMembershipForOrg(adminUser.id, organization.id))!.membership.id);

    const response = await DELETE(jsonRequest(membersUrl(targetMembership.id), { method: "DELETE", cookie: adminCookie }), {
      params: Promise.resolve({ memberId: targetMembership.id }),
    });
    expect(response.status).toBe(404);

    const member = await repo.findMemberById(targetMembership.id);
    expect(member).not.toBeNull();
  });
});
