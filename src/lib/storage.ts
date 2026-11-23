import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage for user uploads: Cloudflare R2 through its S3 API.
 * The browser uploads straight to the bucket with a short-lived presigned
 * URL, so file bytes never pass through this app's server.
 *
 * Unconfigured (any `R2_*` var missing) is a supported state: uploads are
 * turned off and `isStorageConfigured()` says so, rather than the app
 * failing to boot for a buyer who doesn't use uploads.
 */
const PRESIGN_TTL_SECONDS = 300;

interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

function readConfig(): StorageConfig | null {
  const {
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET: bucket,
    R2_PUBLIC_URL: publicUrl,
  } = process.env;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  if (!/^[0-9a-f]{32}$/.test(accountId)) {
    throw new Error(
      "R2_ACCOUNT_ID must be the 32-character account id, not the endpoint URL (https://<id>.r2.cloudflarestorage.com)",
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: publicUrl.replace(/\/+$/, "") };
}

let cached: { config: StorageConfig; client: S3Client } | null | undefined;

function storage() {
  if (cached === undefined) {
    const config = readConfig();
    cached = config && {
      config,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        // <endpoint>/<bucket>/<key>, not <bucket>.<endpoint>: the CSP's
        // connect-src (next.config.ts) allows exactly the account endpoint.
        forcePathStyle: true,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
    };
  }
  if (!cached) throw new Error("Storage is not configured: set the R2_* variables in .env");
  return cached;
}

export function isStorageConfigured(): boolean {
  return readConfig() !== null;
}

/** Where a stored object is publicly readable (the bucket's public URL). */
export function publicObjectUrl(key: string): string {
  return `${storage().config.publicUrl}/${key}`;
}

/**
 * A URL the browser can PUT exactly one file to. Content-Type and
 * Content-Length are signed, so the upload must declare the type and size
 * the server approved; the bytes themselves are checked after upload.
 */
export async function presignUpload(key: string, contentType: string, size: number): Promise<string> {
  const { client, config } = storage();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: PRESIGN_TTL_SECONDS, signableHeaders: new Set(["content-type", "content-length"]) },
  );
}

/** The object's size in bytes, or null if it doesn't exist. */
export async function objectSize(key: string): Promise<number | null> {
  const { client, config } = storage();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return head.ContentLength ?? 0;
  } catch (error) {
    if (error instanceof NotFound) return null;
    throw error;
  }
}

/** The object's first `length` bytes. */
export async function readObjectStart(key: string, length: number): Promise<Uint8Array> {
  const { client, config } = storage();
  const object = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=0-${length - 1}` }),
  );
  return object.Body ? object.Body.transformToByteArray() : new Uint8Array();
}

export async function deleteObject(key: string): Promise<void> {
  const { client, config } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/** An org's logo URL, or null when it has none or storage is off. */
export function orgLogoUrl(organization: { logoKey: string | null }): string | null {
  return organization.logoKey && isStorageConfigured() ? publicObjectUrl(organization.logoKey) : null;
}
