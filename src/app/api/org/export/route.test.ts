import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { POST as createOrg } from "../route";
import { jsonRequest, signUpAndGetCookie } from "../test-helpers";
import { APP_URL } from "@/lib/env";
import * as repo from "@/db/repo";

const EXPORT_URL = `${APP_URL}/api/org/export`;

async function createOrgAsOwner(name: string) {
  const { cookie, user } = await signUpAndGetCookie(`owner-${crypto.randomUUID()}@example.com`);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name } }));
  const { organization } = await response.json();
  return { cookie, user, organization };
}

function exportAs(cookie?: string) {
  return GET(jsonRequest(EXPORT_URL, { method: "GET", cookie }));
}

describe("GET /api/org/export", () => {
  it("requires authentication", async () => {
    expect((await exportAs()).status).toBe(401);
  });

  it("is for the owner only", async () => {
    const { organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const { cookie: adminCookie, user: admin } = await signUpAndGetCookie(`admin-${crypto.randomUUID()}@example.com`);
    await repo.addMember({ orgId: organization.id, userId: admin.id, role: "admin" });

    expect((await exportAs(adminCookie)).status).toBe(403);
  });

  it("downloads the owner's org, members and invites, without invite tokens", async () => {
    const { cookie, user, organization } = await createOrgAsOwner(`Acme ${crypto.randomUUID()}`);
    const invite = await repo.createInvite({
      orgId: organization.id,
      email: `invitee-${crypto.randomUUID()}@example.com`,
      role: "member",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      invitedByUserId: user.id,
    });

    const response = await exportAs(cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="organization-export-/);

    const text = await response.text();
    expect(text).not.toContain(invite.token);
    const data = JSON.parse(text);
    expect(data.organization).toMatchObject({ id: organization.id, name: organization.name });
    expect(data.members).toEqual([expect.objectContaining({ email: user.email, role: "owner" })]);
    expect(data.invites).toEqual([expect.objectContaining({ email: invite.email, role: "member" })]);
  });

  it("only ever contains the caller's own org (no cross-tenant leakage)", async () => {
    const other = await createOrgAsOwner(`Other ${crypto.randomUUID()}`);
    const { cookie, organization } = await createOrgAsOwner(`Mine ${crypto.randomUUID()}`);

    const text = await (await exportAs(cookie)).text();
    expect(JSON.parse(text).organization.id).toBe(organization.id);
    expect(text).not.toContain(other.organization.id);
    expect(text).not.toContain(other.user.email);
  });
});
