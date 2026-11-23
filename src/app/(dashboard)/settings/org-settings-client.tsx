"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrgRole = "owner" | "admin" | "member";

export interface MemberRow {
  id: string;
  role: OrgRole;
  createdAt: string;
  userId: string;
  name: string;
  email: string;
}

export const ASSIGNABLE_ROLES: OrgRole[] = ["admin", "member"];

/**
 * Renders the member list plus (for owners/admins only) role-management,
 * removal, and invite controls. Permission checks are enforced server-side
 * in `/api/org/members/[memberId]` and `/api/org/invites` — hiding controls
 * here is a UX nicety, not the actual security boundary (see those routes'
 * own comments and the pipeline log for Step 2.3/2.4).
 */
/**
 * Role changes, removals and invites through `/api/org/*`, which enforce
 * the permission checks; both dashboard layouts' member views use this.
 */
export function useMemberActions() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const [invitePending, setInvitePending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  /** Resolves true when the change was saved. */
  async function changeRole(memberId: string, role: OrgRole): Promise<boolean> {
    setError(null);
    setPendingMemberId(memberId);

    const response = await fetch(`/api/org/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });

    setPendingMemberId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not update this member's role.");
      return false;
    }
    router.refresh();
    return true;
  }

  /** Resolves true when the member was removed. */
  async function remove(memberId: string): Promise<boolean> {
    setError(null);
    setPendingMemberId(memberId);

    const response = await fetch(`/api/org/members/${memberId}`, { method: "DELETE" });

    setPendingMemberId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not remove this member.");
      return false;
    }
    router.refresh();
    return true;
  }

  /** Resolves true when the invite was sent. */
  async function invite(email: string, role: OrgRole): Promise<boolean> {
    setInviteError(null);
    setInviteMessage(null);
    setInvitePending(true);

    const response = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });

    setInvitePending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setInviteError(body.error ?? "Could not send the invite.");
      return false;
    }
    setInviteMessage(`Invite sent to ${email}.`);
    return true;
  }

  function clearMessages() {
    setError(null);
    setInviteError(null);
    setInviteMessage(null);
  }

  return { changeRole, remove, invite, clearMessages, error, pendingMemberId, invitePending, inviteMessage, inviteError };
}

export function OrgSettingsClient({
  currentUserId,
  currentRole,
  members,
}: {
  currentUserId: string;
  currentRole: OrgRole;
  members: MemberRow[];
}) {
  const canManage = currentRole === "owner" || currentRole === "admin";
  const { changeRole, remove, invite, error, pendingMemberId, invitePending, inviteMessage, inviteError } = useMemberActions();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (await invite(inviteEmail, inviteRole)) setInviteEmail("");
  }

  return (
    <div className="flex flex-col gap-8">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 font-medium">Member</th>
            <th className="py-2 font-medium">Role</th>
            {canManage && <th className="py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const isOwnerRow = member.role === "owner";
            const isBusy = pendingMemberId === member.id;
            return (
              <tr key={member.id} className="border-b">
                <td className="py-2">
                  <div className="font-medium text-foreground">
                    {member.name}
                    {member.userId === currentUserId && " (you)"}
                  </div>
                  <div className="text-muted-foreground">{member.email}</div>
                </td>
                <td className="py-2">
                  {canManage && !isOwnerRow ? (
                    <select
                      value={member.role}
                      disabled={isBusy}
                      onChange={(e) => changeRole(member.id, e.target.value as OrgRole)}
                      className="rounded-md border border-input px-2 py-1 text-sm"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="capitalize">{member.role}</span>
                  )}
                </td>
                {canManage && (
                  <td className="py-2">
                    {!isOwnerRow && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => remove(member.id)}
                        className="text-destructive underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canManage && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Invite a member</h2>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="Email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-md border border-input px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="rounded-md border border-input px-3 py-2 text-sm"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={invitePending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Send invite
            </button>
          </form>
          {inviteMessage && <p className="text-sm text-success">{inviteMessage}</p>}
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
        </div>
      )}
    </div>
  );
}
