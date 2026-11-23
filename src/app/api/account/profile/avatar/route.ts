import { z } from "zod";
import { avatarKeyFromUrl, isAvatarKeyForUser } from "@/core/account/avatar-upload";
import { LOGO_MAX_BYTES, LOGO_TYPES, SNIFF_BYTES, sniffImageType } from "@/core/brand/logo-upload";
import { setUserImage } from "@/db/repo";
import { parseJsonBody } from "@/lib/parse-body";
import { requireSessionUser } from "@/lib/require-session";
import { deleteObject, isStorageConfigured, objectSize, publicObjectUrl, readObjectStart } from "@/lib/storage";

const confirmBody = z.object({ key: z.string({ error: "Unknown upload." }) });

async function signedInWithStorage(request: Request) {
  const user = await requireSessionUser(request);
  if (!user) return { response: Response.json({ error: "Not signed in." }, { status: 401 }) };
  if (!isStorageConfigured()) {
    return { response: Response.json({ error: "Picture uploads are not configured on this server." }, { status: 503 }) };
  }
  return { user };
}

/** Removes an object, logging rather than failing the request if that errors. */
async function discard(key: string) {
  try {
    await deleteObject(key);
  } catch (error) {
    console.error(`Could not delete stored object ${key}`, error);
  }
}

/**
 * Step two of an avatar upload: checks what was actually uploaded — its
 * size, and its type from the file's own signature, not the browser's MIME
 * type — then makes it the user's picture and deletes the previous one. A
 * file that fails the check is deleted.
 */
export async function PUT(request: Request) {
  const { user, response } = await signedInWithStorage(request);
  if (!user) return response;

  const parsed = await parseJsonBody(request, confirmBody);
  if (!parsed.ok) return parsed.response;
  const { key } = parsed.data;
  if (!isAvatarKeyForUser(key, user.id)) {
    return Response.json({ error: "Unknown upload." }, { status: 400 });
  }

  const size = await objectSize(key);
  if (size === null) {
    return Response.json({ error: "Upload not found. Upload the file first." }, { status: 400 });
  }
  if (size > LOGO_MAX_BYTES) {
    await discard(key);
    return Response.json({ error: "The picture must be 2 MB or smaller." }, { status: 400 });
  }
  const sniffed = sniffImageType(await readObjectStart(key, SNIFF_BYTES));
  if (!sniffed || !key.endsWith(`.${LOGO_TYPES[sniffed]}`)) {
    await discard(key);
    return Response.json({ error: "That file isn't a valid PNG, JPEG or WebP image." }, { status: 400 });
  }

  const previous = avatarKeyFromUrl(user.image, user.id);
  const image = publicObjectUrl(key);
  await setUserImage(user.id, image);
  if (previous && previous !== key) await discard(previous);

  return Response.json({ image });
}

/** Removes the user's uploaded picture; the initial shows instead. */
export async function DELETE(request: Request) {
  const { user, response } = await signedInWithStorage(request);
  if (!user) return response;

  await setUserImage(user.id, null);
  const previous = avatarKeyFromUrl(user.image, user.id);
  if (previous) await discard(previous);

  return new Response(null, { status: 204 });
}
