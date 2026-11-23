import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory bucket in place of R2: these tests cover the routes' rules,
// not the network. R2's own enforcement of the signed size and type was
// checked against the real bucket (see the pipeline log).
const bucket = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@/lib/storage", () => ({
  isStorageConfigured: () => true,
  presignUpload: vi.fn(async (key: string) => `https://bucket.test/${key}?signed`),
  publicObjectUrl: (key: string) => `https://cdn.test/${key}`,
  objectSize: async (key: string) => bucket.get(key)?.length ?? null,
  readObjectStart: async (key: string, n: number) => (bucket.get(key) ?? new Uint8Array()).slice(0, n),
  deleteObject: async (key: string) => void bucket.delete(key),
}));

import { addMember, findOrganizationById } from "@/db/repo";
import { APP_URL } from "@/lib/env";
import { LOGO_MAX_BYTES, newLogoKey } from "@/core/brand/logo-upload";
import { POST as createOrg } from "../route";
import { jsonRequest, signUpAndGetCookie } from "../test-helpers";
import { DELETE, PUT } from "./route";
import { POST as uploadUrl } from "./upload-url/route";

const UPLOAD_URL = `${APP_URL}/api/org/logo/upload-url`;
const LOGO_URL = `${APP_URL}/api/org/logo`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);

async function ownerWithOrg() {
  const { cookie, user } = await signUpAndGetCookie(`logo-owner-${crypto.randomUUID()}@example.com`);
  const response = await createOrg(jsonRequest(`${APP_URL}/api/org`, { method: "POST", cookie, body: { name: "Logo Co" } }));
  const { organization } = await response.json();
  return { cookie, user, orgId: organization.id as string };
}

async function memberOf(orgId: string, role: "admin" | "member") {
  const { cookie, user } = await signUpAndGetCookie(`logo-${role}-${crypto.randomUUID()}@example.com`);
  await addMember({ orgId, userId: user.id, role });
  return cookie;
}

async function logoKeyOf(orgId: string) {
  const org = await findOrganizationById(orgId);
  return org?.logoKey;
}

/** The full flow: presign, "upload" into the fake bucket, confirm. */
async function uploadLogo(cookie: string, bytes: Uint8Array = PNG, contentType = "image/png") {
  const ticket = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie, body: { contentType, size: bytes.length } }));
  const { key } = await ticket.json();
  bucket.set(key, bytes);
  return { key: key as string, response: await PUT(jsonRequest(LOGO_URL, { method: "PUT", cookie, body: { key } })) };
}

beforeEach(() => bucket.clear());

describe("POST /api/org/logo/upload-url", () => {
  it("requires sign-in, and owner or admin", async () => {
    const anon = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", body: { contentType: "image/png", size: 10 } }));
    expect(anon.status).toBe(401);

    const { orgId } = await ownerWithOrg();
    const member = await memberOf(orgId, "member");
    const denied = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie: member, body: { contentType: "image/png", size: 10 } }));
    expect(denied.status).toBe(403);

    const admin = await memberOf(orgId, "admin");
    const allowed = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie: admin, body: { contentType: "image/png", size: 10 } }));
    expect(allowed.status).toBe(200);
  });

  it("issues a key in the caller's own org prefix", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const response = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie, body: { contentType: "image/webp", size: 1000 } }));
    const body = await response.json();
    expect(body.key).toMatch(new RegExp(`^orgs/${orgId}/logo/.+\\.webp$`));
    expect(body.uploadUrl).toContain(body.key);
  });

  it("rejects SVG and other types, and sizes over 2 MB or not positive", async () => {
    const { cookie } = await ownerWithOrg();
    for (const body of [
      { contentType: "image/svg+xml", size: 10 },
      { contentType: "text/html", size: 10 },
      { contentType: "image/png", size: LOGO_MAX_BYTES + 1 },
      { contentType: "image/png", size: 0 },
      { contentType: "image/png", size: 1.5 },
      { contentType: "image/png" },
    ]) {
      const response = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie, body }));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("PUT /api/org/logo", () => {
  it("saves a checked upload as the org's logo and returns its URL", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const { key, response } = await uploadLogo(cookie);
    expect(response.status).toBe(200);
    expect((await response.json()).logoUrl).toBe(`https://cdn.test/${key}`);
    expect(await logoKeyOf(orgId)).toBe(key);
  });

  it("judges the type by the file's bytes, not its declared type, and deletes a fake", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const html = new Uint8Array(Buffer.from("<html><script>alert(1)</script></html>"));
    const { key, response } = await uploadLogo(cookie, html, "image/png");
    expect(response.status).toBe(400);
    expect(bucket.has(key)).toBe(false);
    expect(await logoKeyOf(orgId)).toBeNull();
  });

  it("rejects a real image whose type doesn't match the one it was declared as", async () => {
    const { cookie } = await ownerWithOrg();
    const { key, response } = await uploadLogo(cookie, PNG, "image/jpeg");
    expect(response.status).toBe(400);
    expect(bucket.has(key)).toBe(false);
  });

  it("rejects and deletes an object over 2 MB", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const key = newLogoKey(orgId, "image/png");
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(PNG);
    bucket.set(key, big);
    const response = await PUT(jsonRequest(LOGO_URL, { method: "PUT", cookie, body: { key } }));
    expect(response.status).toBe(400);
    expect(bucket.has(key)).toBe(false);
  });

  it("refuses a key from another org, and leaves that object alone", async () => {
    const victim = await ownerWithOrg();
    const { key } = await uploadLogo(victim.cookie);
    const attacker = await ownerWithOrg();

    const response = await PUT(jsonRequest(LOGO_URL, { method: "PUT", cookie: attacker.cookie, body: { key } }));
    expect(response.status).toBe(400);
    expect(await logoKeyOf(attacker.orgId)).toBeNull();
    expect(bucket.has(key)).toBe(true);
  });

  it("refuses a key that was never uploaded", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const key = newLogoKey(orgId, "image/png");
    const response = await PUT(jsonRequest(LOGO_URL, { method: "PUT", cookie, body: { key } }));
    expect(response.status).toBe(400);
  });

  it("blocks members, and deletes the previous logo on replace", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const first = await uploadLogo(cookie);
    const member = await memberOf(orgId, "member");
    const denied = await PUT(jsonRequest(LOGO_URL, { method: "PUT", cookie: member, body: { key: first.key } }));
    expect(denied.status).toBe(403);

    const second = await uploadLogo(cookie);
    expect(second.response.status).toBe(200);
    expect(await logoKeyOf(orgId)).toBe(second.key);
    expect(bucket.has(first.key)).toBe(false);
  });
});

describe("DELETE /api/org/logo", () => {
  it("clears the logo and deletes the object; members can't", async () => {
    const { cookie, orgId } = await ownerWithOrg();
    const { key } = await uploadLogo(cookie);

    const member = await memberOf(orgId, "member");
    expect((await DELETE(jsonRequest(LOGO_URL, { method: "DELETE", cookie: member }))).status).toBe(403);
    expect(await logoKeyOf(orgId)).toBe(key);

    expect((await DELETE(jsonRequest(LOGO_URL, { method: "DELETE", cookie }))).status).toBe(204);
    expect(await logoKeyOf(orgId)).toBeNull();
    expect(bucket.has(key)).toBe(false);
  });
});
