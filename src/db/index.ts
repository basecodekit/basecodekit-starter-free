import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as auth from "@/db/schema/auth";
import * as org from "@/db/schema/org";

/**
 * Typed Drizzle data-access layer for the whole app. Uses the `postgres`
 * (postgres.js) driver, deliberately separate from the `pg.Pool` Better
 * Auth's own instance in `@/lib/auth.ts` owns and manages — Better Auth
 * needs a client its own Kysely adapter controls end-to-end, this client is
 * only for the app's own read/write access (including read/join access to
 * Better Auth's tables via `schema.auth.*`, and going forward, the app's own
 * tables such as `organizations`).
 */
const client = postgres(process.env.DATABASE_URL as string);

export const schema = {
  ...auth,
  ...org,
};

export const db = drizzle(client, { schema });
