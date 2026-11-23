import { beforeEach, describe, expect, it, vi } from "vitest";

const bucket = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@/lib/storage", () => ({
  isStorageConfigured: () => true,
  presignUpload: vi.fn(async (key: string) => `https://bucket.test/${key}?signed`),
  publicObjectUrl: (key: string) => `https://cdn.test/${key}`,
  objectSize: async (key: string) => bucket.get(key)?.length ?? null,
  readObjectStart: async (key: string, n: number) => (bucket.get(key) ?? new Uint8Array()).slice(0, n),
  deleteObject: async (key: string) => void bucket.delete(key),
}));

import { newAvatarKey } from "@/core/account/avatar-upload";
import { LOGO_MAX_BYTES } from "@/core/brand/logo-upload";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/env";
import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { jsonRequest, signUpAndGetCookie } from "../../../org/test-helpers";
import { DELETE, PUT } from "./route";
import { POST as uploadUrl } from "./upload-url/route";

const UPLOAD_URL = `${APP_URL}/api/account/profile/avatar/upload-url`;
const AVATAR_URL = `${APP_URL}/api/account/profile/avatar`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);

const signUp = () => signUpAndGetCookie(`avatar-${crypto.randomUUID()}@example.com`);

async function imageOf(userId: string) {
  const user = await (await auth.$context).internalAdapter.findUserById(userId);
  return user?.image ?? null;
}

async function uploadAvatar(cookie: string, bytes: Uint8Array = PNG, contentType = "image/png") {
  const ticket = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie, body: { contentType, size: bytes.length } }));
  const { key } = await ticket.json();
  bucket.set(key, bytes);
  const response = await PUT(jsonRequest(AVATAR_URL, { method: "PUT", cookie, body: { key } }));
  return { key: key as string, response };
}

beforeEach(() => bucket.clear());

describe("avatar upload", () => {
  it("requires a session", async () => {
    const response = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", body: { contentType: "image/png", size: 10 } }));
    expect(response.status).toBe(401);
  });

  it("issues a key inside the caller's own prefix and rejects bad types and sizes", async () => {
    const { cookie, user } = await signUp();
    const ok = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie, body: { contentType: "image/webp", size: 1000 } }));
    expect((await ok.json()).key).toMatch(new RegExp(`^users/${user.id}/avatar/.+\\.webp$`));
    for (const body of [
      { contentType: "image/svg+xml", size: 10 },
      { contentType: "image/png", size: LOGO_MAX_BYTES + 1 },
      { contentType: "image/png", size: 0 },
    ]) {
      const response = await uploadUrl(jsonRequest(UPLOAD_URL, { method: "POST", cookie, body }));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("saves a checked upload as user.image and replaces the previous one", async () => {
    const { cookie, user } = await signUp();
    const first = await uploadAvatar(cookie);
    expect(first.response.status).toBe(200);
    expect(await imageOf(user.id)).toBe(`https://cdn.test/${first.key}`);

    const second = await uploadAvatar(cookie);
    expect(await imageOf(user.id)).toBe(`https://cdn.test/${second.key}`);
    expect(bucket.has(first.key)).toBe(false);
  });

  it("judges the type by the file's bytes and deletes a fake", async () => {
    const { cookie, user } = await signUp();
    const html = new Uint8Array(Buffer.from("<html><script>alert(1)</script></html>"));
    const { key, response } = await uploadAvatar(cookie, html);
    expect(response.status).toBe(400);
    expect(bucket.has(key)).toBe(false);
    expect(await imageOf(user.id)).toBeNull();
  });

  it("refuses a key under another user's prefix, and leaves that object alone", async () => {
    const victim = await signUp();
    const { key } = await uploadAvatar(victim.cookie);
    const attacker = await signUp();
    const response = await PUT(jsonRequest(AVATAR_URL, { method: "PUT", cookie: attacker.cookie, body: { key } }));
    expect(response.status).toBe(400);
    expect(await imageOf(attacker.user.id)).toBeNull();
    expect(bucket.has(key)).toBe(true);
    expect(newAvatarKey(attacker.user.id, "png")).not.toBe(key);
  });

  it("removes the picture and its file", async () => {
    const { cookie, user } = await signUp();
    const { key } = await uploadAvatar(cookie);
    const response = await DELETE(jsonRequest(AVATAR_URL, { method: "DELETE", cookie }));
    expect(response.status).toBe(204);
    expect(await imageOf(user.id)).toBeNull();
    expect(bucket.has(key)).toBe(false);
  });

  it("Better Auth's own update-user refuses to set an image URL, but still renames", async () => {
    const { cookie } = await signUp();
    const send = (body: unknown) =>
      authPost(jsonRequest(`${APP_URL}/api/auth/update-user`, { method: "POST", cookie, body }));
    expect((await send({ image: "https://evil.test/x.png" })).status).toBe(400);
    expect((await send({ name: "x".repeat(201) })).status).toBe(400);
    expect((await send({ name: "New Name" })).status).toBe(200);
  });
});
