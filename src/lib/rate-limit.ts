import { authPool } from "@/lib/auth-pool";

/**
 * Fixed-window limiter for the app's own sensitive actions (magic links,
 * email changes, session revocation, account deletion).
 *
 * Counters live in Postgres, in Better Auth's `rateLimit` table (every ORM
 * template creates it), under `app:`-prefixed keys Better Auth never reads.
 * So every server instance shares them: an in-memory counter would be
 * separate per serverless instance and reset on every cold start. One atomic
 * upsert per call, so concurrent requests can't both slip under the limit.
 * For these keys `lastRequest` holds the start of the current window.
 */
export async function checkRateLimit(key: string, windowMs: number, max: number): Promise<boolean> {
  const now = Date.now();
  const { rows } = await authPool.query<{ count: number }>(
    `INSERT INTO "rateLimit" (id, key, count, "lastRequest")
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN "rateLimit"."lastRequest" <= $3 - $4 THEN 1 ELSE "rateLimit".count + 1 END,
       "lastRequest" = CASE WHEN "rateLimit"."lastRequest" <= $3 - $4 THEN $3 ELSE "rateLimit"."lastRequest" END
     RETURNING count`,
    [crypto.randomUUID(), `app:${key}`, now, windowMs],
  );
  return rows[0].count <= max;
}
