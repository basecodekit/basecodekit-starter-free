import { z } from "zod";
import { newAvatarKey } from "@/core/account/avatar-upload";
import { isLogoContentType, LOGO_MAX_BYTES, LOGO_TYPES, type LogoContentType } from "@/core/brand/logo-upload";
import { parseJsonBody } from "@/lib/parse-body";
import { requireSessionUser } from "@/lib/require-session";
import { isStorageConfigured, presignUpload } from "@/lib/storage";

const TYPE_ERROR = "The picture must be a PNG, JPEG or WebP image.";
const SIZE_ERROR = "The picture must be 2 MB or smaller.";

const uploadBody = z.object({
  contentType: z.custom<LogoContentType>(isLogoContentType, TYPE_ERROR),
  size: z.number({ error: SIZE_ERROR }).int(SIZE_ERROR).positive(SIZE_ERROR).max(LOGO_MAX_BYTES, SIZE_ERROR),
});

/**
 * Step one of an avatar upload: the signed-in user asks for a presigned URL,
 * then PUTs the file straight to the bucket. The URL is signed for the
 * declared type and exact size. Nothing is shown until
 * `PUT /api/account/profile/avatar` has checked the bytes.
 */
export async function POST(request: Request) {
  const user = await requireSessionUser(request);
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return Response.json({ error: "Picture uploads are not configured on this server." }, { status: 503 });
  }

  const parsed = await parseJsonBody(request, uploadBody);
  if (!parsed.ok) return parsed.response;
  const { contentType, size } = parsed.data;

  const key = newAvatarKey(user.id, LOGO_TYPES[contentType]);
  const uploadUrl = await presignUpload(key, contentType, size);
  return Response.json({ key, uploadUrl });
}
