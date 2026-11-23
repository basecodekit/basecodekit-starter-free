import { z } from "zod";
import { isLogoContentType, LOGO_MAX_BYTES, type LogoContentType, newLogoKey } from "@/core/brand/logo-upload";
import { parseJsonBody } from "@/lib/parse-body";
import { orgAccessErrorResponse, requireOrgAccess } from "@/lib/require-org-access";
import { isStorageConfigured, presignUpload } from "@/lib/storage";

const TYPE_ERROR = "The logo must be a PNG, JPEG or WebP image.";
const SIZE_ERROR = "The logo must be 2 MB or smaller.";

const uploadBody = z.object({
  contentType: z.custom<LogoContentType>(isLogoContentType, TYPE_ERROR),
  size: z.number({ error: SIZE_ERROR }).int(SIZE_ERROR).positive(SIZE_ERROR).max(LOGO_MAX_BYTES, SIZE_ERROR),
});

/**
 * Step one of a logo upload: an owner/admin asks for a presigned URL, then
 * PUTs the file straight to the bucket. The URL is signed for the declared
 * type and exact size, so the bucket rejects anything else. Nothing is
 * shown anywhere until `PUT /api/org/logo` has checked the bytes.
 */
export async function POST(request: Request) {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess; the key is built from the
  // caller's own org id, never a client-supplied one.
  const access = await requireOrgAccess(request.headers, { minRole: "admin" });
  if (!access.ok) {
    return orgAccessErrorResponse(access, { "insufficient-role": "Only owners and admins can change the logo." });
  }
  if (!isStorageConfigured()) {
    return Response.json({ error: "Logo uploads are not configured on this server." }, { status: 503 });
  }

  const parsed = await parseJsonBody(request, uploadBody);
  if (!parsed.ok) return parsed.response;
  const { contentType, size } = parsed.data;

  const key = newLogoKey(access.organization.id, contentType);
  const uploadUrl = await presignUpload(key, contentType, size);
  return Response.json({ key, uploadUrl });
}
