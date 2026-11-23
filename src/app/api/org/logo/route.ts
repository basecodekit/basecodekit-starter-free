import { z } from "zod";
import { setOrganizationLogoKey } from "@/db/repo";
import { isLogoKeyForOrg, LOGO_MAX_BYTES, LOGO_TYPES, SNIFF_BYTES, sniffImageType } from "@/core/brand/logo-upload";
import { parseJsonBody } from "@/lib/parse-body";
import { orgAccessErrorResponse, requireOrgAccess } from "@/lib/require-org-access";
import { deleteObject, isStorageConfigured, objectSize, publicObjectUrl, readObjectStart } from "@/lib/storage";

const DENIED = { "insufficient-role": "Only owners and admins can change the logo." };

// The key must also sit inside the caller's org prefix; that needs the org,
// so the route checks it after parsing.
const confirmBody = z.object({ key: z.string({ error: "Unknown upload." }) });

async function adminAccess(request: Request) {
  // ORG-SCOPED-QUERY: gated by requireOrgAccess — the org is always the
  // caller's own, and a key is accepted only inside that org's prefix.
  const access = await requireOrgAccess(request.headers, { minRole: "admin" });
  if (!access.ok) return { response: orgAccessErrorResponse(access, DENIED) };
  if (!isStorageConfigured()) {
    return { response: Response.json({ error: "Logo uploads are not configured on this server." }, { status: 503 }) };
  }
  return { access };
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
 * Step two of a logo upload: checks what was actually uploaded — its size,
 * and its type from the file's own signature, not the browser's MIME type —
 * then makes it the org's logo and deletes the previous one. A file that
 * fails the check is deleted.
 */
export async function PUT(request: Request) {
  const { access, response } = await adminAccess(request);
  if (!access) return response;
  const { organization } = access;

  const parsed = await parseJsonBody(request, confirmBody);
  if (!parsed.ok) return parsed.response;
  const { key } = parsed.data;
  if (!isLogoKeyForOrg(key, organization.id)) {
    return Response.json({ error: "Unknown upload." }, { status: 400 });
  }

  const size = await objectSize(key);
  if (size === null) {
    return Response.json({ error: "Upload not found. Upload the file first." }, { status: 400 });
  }
  if (size > LOGO_MAX_BYTES) {
    await discard(key);
    return Response.json({ error: "The logo must be 2 MB or smaller." }, { status: 400 });
  }
  const sniffed = sniffImageType(await readObjectStart(key, SNIFF_BYTES));
  if (!sniffed || !key.endsWith(`.${LOGO_TYPES[sniffed]}`)) {
    await discard(key);
    return Response.json({ error: "That file isn't a valid PNG, JPEG or WebP image." }, { status: 400 });
  }

  await setOrganizationLogoKey(organization.id, key);
  if (organization.logoKey && organization.logoKey !== key) await discard(organization.logoKey);

  return Response.json({ logoUrl: publicObjectUrl(key) });
}

/** Removes the org's logo; it falls back to `siteConfig.brand`'s. */
export async function DELETE(request: Request) {
  const { access, response } = await adminAccess(request);
  if (!access) return response;
  const { organization } = access;

  await setOrganizationLogoKey(organization.id, null);
  if (organization.logoKey) await discard(organization.logoKey);

  return new Response(null, { status: 204 });
}
