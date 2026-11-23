"use client";

import { ButtonLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { SIGNED_IN_HOME } from "@/lib/safe-redirect";

/**
 * Landing header's account links: "Sign in / Get started" for visitors,
 * "Dashboard" once a session is known. Resolved in the browser so the
 * landing page itself stays static (fast, and identical for crawlers);
 * visitors see the signed-out links until the session check answers.
 */
export function HeaderAuthLinks() {
  const { data: session } = authClient.useSession();

  if (session) {
    return <ButtonLink href={SIGNED_IN_HOME}>Dashboard</ButtonLink>;
  }
  return (
    <>
      <ButtonLink href="/login" variant="ghost">
        Sign in
      </ButtonLink>
      <ButtonLink href="/signup">Get started</ButtonLink>
    </>
  );
}
