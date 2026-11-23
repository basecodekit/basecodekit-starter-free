import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeCallbackURL } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

/** Already signed in? Then there's nothing to do here — go where the visitor
 * was headed (a safe `callbackURL`, e.g. an invite) or the dashboard. A
 * real session check, not a cookie sniff, so a stale cookie just shows the
 * form instead of bouncing between pages. */
export default async function Page({ searchParams }: PageProps<"/login">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect(safeCallbackURL((await searchParams).callbackURL));
  }
  return <LoginForm />;
}
