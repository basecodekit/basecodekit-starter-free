import { describe, expect, it } from "vitest";
import { requireOrgAccess } from "./require-org-access";
import { POST as createOrg } from "@/app/api/org/route";
import { jsonRequest, signUpAndGetCookie } from "@/app/api/org/test-helpers";
import { APP_URL } from "@/lib/env";
import { addMember, deleteMember, getMembershipForOrg } from "@/db/repo";

async function createOrgAsOwner(name: string) {
  const { cookie, user } = await signUpAndGetCookie(`req-org-access-owner-${crypto.randomUUID()}@example.com`);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name } }));
  const { organization } = await response.json();
  return { ownerCookie: cookie, ownerUser: user, organization };
}

function headersFor(cookie?: string): Headers {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

describe("requireOrgAccess", () => {
  it("denies with reason 'unauthenticated' when there's no session", async () => {
    const result = await requireOrgAccess(headersFor());
    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("denies with reason 'no-membership' for a signed-in user with no org", async () => {
    const { cookie } = await signUpAndGetCookie(`req-org-access-no-org-${crypto.randomUUID()}@example.com`);
    const result = await requireOrgAccess(headersFor(cookie));
    expect(result).toEqual({ ok: false, reason: "no-membership" });
  });

  it("grants access to a member for the default (any-member) minRole", async () => {
    const { ownerCookie, organization, ownerUser } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const result = await requireOrgAccess(headersFor(ownerCookie));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.organization.id).toBe(organization.id);
    expect(result.membership.role).toBe("owner");
    expect(result.user.id).toBe(ownerUser.id);
  });

  it("denies with reason 'insufficient-role' when a plain member is checked against minRole 'admin'", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: memberCookie, user: memberUser } = await signUpAndGetCookie(
      `req-org-access-member-${crypto.randomUUID()}@example.com`,
    );
    await addMember({ orgId: organization.id, userId: memberUser.id, role: "member" });

    const result = await requireOrgAccess(headersFor(memberCookie), { minRole: "admin" });
    expect(result).toEqual({ ok: false, reason: "insufficient-role" });
  });

  it("grants access when an admin is checked against minRole 'admin'", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie, user: adminUser } = await signUpAndGetCookie(
      `req-org-access-admin-${crypto.randomUUID()}@example.com`,
    );
    await addMember({ orgId: organization.id, userId: adminUser.id, role: "admin" });

    const result = await requireOrgAccess(headersFor(adminCookie), { minRole: "admin" });
    expect(result.ok).toBe(true);
  });

  it("denies with reason 'no-membership' (not 'insufficient-role') when an explicit orgId belongs to an org the caller isn't in", async () => {
    const { ownerCookie: org1OwnerCookie } = await createOrgAsOwner(`Org One ${crypto.randomUUID()}`);
    const { organization: org2 } = await createOrgAsOwner(`Org Two ${crypto.randomUUID()}`);

    // org1's owner is not a member of org2 at all — this must never be
    // distinguishable from "org2 doesn't exist" (cross-tenant leakage class).
    const result = await requireOrgAccess(headersFor(org1OwnerCookie), { orgId: org2.id });
    expect(result).toEqual({ ok: false, reason: "no-membership" });
  });

  it("grants access for an explicit orgId the caller genuinely belongs to", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: memberCookie, user: memberUser } = await signUpAndGetCookie(
      `req-org-access-explicit-org-${crypto.randomUUID()}@example.com`,
    );
    await addMember({ orgId: organization.id, userId: memberUser.id, role: "member" });

    const result = await requireOrgAccess(headersFor(memberCookie), { orgId: organization.id });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.organization.id).toBe(organization.id);
  });

  it("re-checks live DB state: a member removed after signing in loses access on the very next call, with no session change at all", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: memberCookie, user: memberUser } = await signUpAndGetCookie(
      `req-org-access-removed-${crypto.randomUUID()}@example.com`,
    );
    await addMember({ orgId: organization.id, userId: memberUser.id, role: "admin" });

    // Confirm access is granted before removal.
    const before = await requireOrgAccess(headersFor(memberCookie), { minRole: "admin" });
    expect(before.ok).toBe(true);

    // Remove the membership row directly — the session cookie itself never
    // changes (Better Auth's session table carries no org data to go
    // stale), which is exactly the scenario this test is proving safe.
    const removed = await getMembershipForOrg(memberUser.id, organization.id);
    await deleteMember(removed!.membership.id);

    const after = await requireOrgAccess(headersFor(memberCookie), { minRole: "admin" });
    expect(after).toEqual({ ok: false, reason: "no-membership" });
  });
});
