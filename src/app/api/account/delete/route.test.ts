import { beforeEach, describe, expect, it, vi } from "vitest";

const deleted = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/storage", () => ({
  isStorageConfigured: () => true,
  publicObjectUrl: (key: string) => `https://cdn.test/${key}`,
  deleteObject: async (key: string) => void deleted.push(key),
}));

import { loadAccountDeletion } from "@/core/account/deletion";
import { addMember, findOrganizationById, setOrganizationLogoKey } from "@/db/repo";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { POST as createOrg } from "../../org/route";
import { jsonRequest, signUpAndGetCookie } from "../../org/test-helpers";
import { DELETE } from "./route";

const URL = `${APP_URL}/api/account/delete`;
const PHRASE = "delete my account";

async function userWithOrg(name = "Erase Co") {
  const { cookie, user } = await signUpAndGetCookie(`erase-${crypto.randomUUID()}@example.com`);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name } }));
  const { organization } = await response.json();
  return { cookie, user, orgId: organization.id as string };
}

const userExists = async (id: string) => (await (await auth.$context).internalAdapter.findUserById(id)) !== null;

beforeEach(() => {
  deleted.length = 0;
});

describe("DELETE /api/account/delete", () => {
  it("requires a session", async () => {
    const response = await DELETE(jsonRequest(URL, { method: "DELETE", body: { confirm: PHRASE } }));
    expect(response.status).toBe(401);
  });

  it("requires the confirmation phrase, and deletes nothing without it", async () => {
    const { cookie, user } = await signUpAndGetCookie(`erase-${crypto.randomUUID()}@example.com`);
    for (const body of [{}, { confirm: "nope" }, { confirm: user.email }]) {
      const response = await DELETE(jsonRequest(URL, { method: "DELETE", cookie, body }));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await userExists(user.id)).toBe(true);
  });

  it("deletes a user with no org and clears their session cookie", async () => {
    const { cookie, user } = await signUpAndGetCookie(`erase-${crypto.randomUUID()}@example.com`);
    const response = await DELETE(jsonRequest(URL, { method: "DELETE", cookie, body: { confirm: PHRASE } }));
    expect(response.status).toBe(204);
    expect(await userExists(user.id)).toBe(false);
    expect(response.headers.getSetCookie().join(";")).toMatch(/session_token=;|Max-Age=0/i);

    const again = await DELETE(jsonRequest(URL, { method: "DELETE", cookie, body: { confirm: PHRASE } }));
    expect(again.status).toBe(401);
  });

  it("deletes the org too when the user is its only member, and its logo", async () => {
    const { cookie, user, orgId } = await userWithOrg();
    await setOrganizationLogoKey(orgId, "orgs/x/logo/a.png");
    expect((await loadAccountDeletion(user.id)).deletesOrg).toEqual({ orgName: "Erase Co" });

    const response = await DELETE(jsonRequest(URL, { method: "DELETE", cookie, body: { confirm: PHRASE } }));
    expect(response.status).toBe(204);
    expect(await findOrganizationById(orgId)).toBeNull();
    expect(await userExists(user.id)).toBe(false);
    expect(deleted).toContain("orgs/x/logo/a.png");
  });

  it("is blocked while the owned org has other members, and changes nothing", async () => {
    const owner = await userWithOrg("Busy Co");
    const other = await signUpAndGetCookie(`erase-${crypto.randomUUID()}@example.com`);
    await addMember({ orgId: owner.orgId, userId: other.user.id, role: "member" });
    expect((await loadAccountDeletion(owner.user.id)).blockedBy).toEqual({ orgName: "Busy Co" });

    const response = await DELETE(jsonRequest(URL, { method: "DELETE", cookie: owner.cookie, body: { confirm: PHRASE } }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Busy Co");
    expect(await userExists(owner.user.id)).toBe(true);
    expect(await findOrganizationById(owner.orgId)).not.toBeNull();
  });

  it("lets a plain member leave without touching the org they belonged to", async () => {
    const owner = await userWithOrg("Keep Co");
    const member = await signUpAndGetCookie(`erase-${crypto.randomUUID()}@example.com`);
    await addMember({ orgId: owner.orgId, userId: member.user.id, role: "member" });

    const response = await DELETE(jsonRequest(URL, { method: "DELETE", cookie: member.cookie, body: { confirm: PHRASE } }));
    expect(response.status).toBe(204);
    expect(await userExists(member.user.id)).toBe(false);
    expect(await findOrganizationById(owner.orgId)).not.toBeNull();
    expect(await userExists(owner.user.id)).toBe(true);
  });

  it("deleting one account leaves another org's data alone", async () => {
    const a = await userWithOrg("A Co");
    const b = await userWithOrg("B Co");
    const response = await DELETE(jsonRequest(URL, { method: "DELETE", cookie: a.cookie, body: { confirm: PHRASE } }));
    expect(response.status).toBe(204);
    expect(await findOrganizationById(b.orgId)).not.toBeNull();
  });
});
