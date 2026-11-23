import type { AccountSession } from "@/app/(dashboard)/account/types";
import { auth } from "@/lib/auth";

const toIso = (value: Date | string) => new Date(value).toISOString();

/**
 * The caller's own unexpired sessions: the current one first, then the
 * rest by latest activity. Tokens are dropped here, so they never reach a
 * page.
 */
export async function loadAccountSessions(requestHeaders: Headers, currentSessionId: string): Promise<AccountSession[]> {
  const rows = await auth.api.listSessions({ headers: requestHeaders });
  const now = Date.now();

  return rows
    .filter((row) => new Date(row.expiresAt).getTime() > now)
    .map((row) => ({
      id: row.id,
      current: row.id === currentSessionId,
      userAgent: row.userAgent ?? null,
      ipAddress: row.ipAddress ?? null,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      expiresAt: toIso(row.expiresAt),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || b.updatedAt.localeCompare(a.updatedAt));
}
