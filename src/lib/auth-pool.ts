import { Pool } from "pg";

/**
 * The Postgres pool Better Auth runs on, whichever ORM the app's own data
 * layer uses. The app's rate limiter (`@/lib/rate-limit`) shares it, since
 * its counters live in Better Auth's `rateLimit` table.
 */
export const authPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
