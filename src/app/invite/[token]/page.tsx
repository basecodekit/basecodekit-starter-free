import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { findInviteByToken, findOrganizationById } from "@/db/repo";
import { AcceptInviteButton } from "./accept-invite-button";
import { SignOutAndSwitchAccount } from "./sign-out-and-switch-account";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-32 text-center">
      {children}
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await findInviteByToken(token);

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">Invite not found</h1>
        <p className="text-sm text-muted-foreground">This invite link isn&apos;t valid.</p>
      </Shell>
    );
  }
  if (invite.acceptedAt) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">Invite already used</h1>
        <p className="text-sm text-muted-foreground">This invite has already been accepted.</p>
      </Shell>
    );
  }
  // This Server Component already reads `headers()`/the database above
  // (request-time only, never prerendered/cached), so comparing against the
  // real current time here is exactly as "impure" as the rest of the
  // function and carries no risk of a stale value leaking into a cached
  // render.
  // eslint-disable-next-line react-hooks/purity -- see comment above
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">Invite expired</h1>
        <p className="text-sm text-muted-foreground">
          Ask whoever invited you to send a new invite.
        </p>
      </Shell>
    );
  }

  const organization = await findOrganizationById(invite.orgId);

  const session = await auth.api.getSession({ headers: await headers() });
  const callbackURL = `/invite/${token}`;

  if (!session) {
    const query = new URLSearchParams({ callbackURL, email: invite.email }).toString();
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">
          You&apos;re invited to {organization?.name ?? "an organization"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in or create an account with <strong>{invite.email}</strong> to accept.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={`/login?${query}`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
          <Link
            href={`/signup?${query}`}
            className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground"
          >
            Create an account
          </Link>
        </div>
      </Shell>
    );
  }

  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">Wrong account</h1>
        <p className="text-sm text-muted-foreground">
          This invite was sent to <strong>{invite.email}</strong>, but you&apos;re signed in as{" "}
          {session.user.email}.
        </p>
        <SignOutAndSwitchAccount callbackURL={callbackURL} email={invite.email} />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-foreground">
        Join {organization?.name ?? "this organization"}
      </h1>
      <p className="text-sm text-muted-foreground">
        You&apos;ve been invited to join as <strong>{invite.role}</strong>.
      </p>
      <AcceptInviteButton token={token} />
    </Shell>
  );
}
