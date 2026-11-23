import { publicObjectUrl } from "@/lib/storage";

/**
 * Keys and URLs for a user's avatar. The upload rules (types, size,
 * signature check) are the org logo's, shared from `@/core/brand/logo-upload`.
 */
const avatarPrefix = (userId: string) => `users/${userId}/avatar/`;

export function newAvatarKey(userId: string, extension: string): string {
  return `${avatarPrefix(userId)}${crypto.randomUUID()}.${extension}`;
}

/** Whether `key` is one `newAvatarKey` could have issued for this user, so
 * one user can't claim an object under another's prefix. */
export function isAvatarKeyForUser(key: unknown, userId: string): key is string {
  if (typeof key !== "string" || !key.startsWith(avatarPrefix(userId))) return false;
  const rest = key.slice(avatarPrefix(userId).length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/.test(rest);
}

/** The object key behind a stored avatar URL, or null when the URL isn't
 * one of ours (an OAuth provider's picture, say). */
export function avatarKeyFromUrl(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const base = publicObjectUrl("");
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length);
  return isAvatarKeyForUser(key, userId) ? key : null;
}
