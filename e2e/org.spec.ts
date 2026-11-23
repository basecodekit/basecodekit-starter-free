import { expect, test } from "@playwright/test";
import { addMember, createInvite, findOrganizationByOwner, findUserByEmail, getMembershipForOrg } from "@/db/repo";
import { APP_URL } from "@/lib/env";
import { needsEmailPassword, removeMember, signUpThroughUi } from "./helpers";

test.skip(...needsEmailPassword);

/** The org the user with this email owns, read from the app's own database. */
async function ownerOrg(ownerEmail: string) {
  const owner = await findUserByEmail(ownerEmail);
  const organization = owner && (await findOrganizationByOwner(owner.id));
  expect(organization).toBeTruthy();
  return organization!;
}

test("create an org, invite a teammate, they accept, and both show up in the member list", async ({ page }) => {
  const ownerEmail = `e2e-org-owner-${crypto.randomUUID()}@example.com`;
  const memberEmail = `e2e-org-member-${crypto.randomUUID()}@example.com`;
  const orgName = `E2E Org ${crypto.randomUUID()}`;

  await page.goto("/signup");
  await signUpThroughUi(page, { name: "Owner E2E", email: ownerEmail, password: "correcthorsebattery" });
  await expect(page).toHaveURL("/dashboard");

  // First visit to /settings for a user with no org yet: the create-org
  // form, not the member list.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Create your organization", exact: true })).toBeVisible();
  await page.getByPlaceholder("Organization name").fill(orgName);
  await page.getByRole("button", { name: "Create organization", exact: true }).click();

  await expect(page.getByRole("heading", { name: orgName, exact: true })).toBeVisible();
  // Layouts with settings sections show members on their own tab.
  await page.goto("/settings?tab=members");
  await expect(page.getByRole("main").getByText(ownerEmail)).toBeVisible();
  await expect(page.getByRole("main").getByText("Owner E2E (you)")).toBeVisible();

  // Sending the actual invite through the UI would trigger a real Resend
  // API call from the live dev server this e2e suite drives (no way to
  // mock `@/lib/email` in that separate process) — the same reason this
  // repo's magic-link flow has zero e2e coverage of its own email-send step
  // (see e2e/auth.spec.ts's absence of one, and the Step 2.3 pipeline log
  // entry). The invite-creation route itself, including that it calls
  // `sendOrgInviteEmail`, is covered for real in
  // `src/app/api/org/invites/route.test.ts` (mocked email). Here, seed the
  // pending invite directly via the same DB the app uses, then drive the
  // rest of the flow (the accept page, the accept action, and the updated
  // member list) through the real UI — the part this e2e suite exists to
  // catch regressions in.
  const ownerOrgRow = await ownerOrg(ownerEmail);

  const invite = await createInvite({
    orgId: ownerOrgRow.id,
    email: memberEmail,
    role: "member",
    invitedByUserId: ownerOrgRow.ownerUserId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  // Sign out the owner and sign up as the invitee.
  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: APP_URL } });
  await page.goto("/signup");
  await signUpThroughUi(page, { name: "Member E2E", email: memberEmail, password: "correcthorsebattery" });
  await expect(page).toHaveURL("/dashboard");

  await page.goto(`/invite/${invite.token}`);
  await expect(page.getByRole("heading", { name: `Join ${orgName}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept invite", exact: true }).click();

  await expect(page).toHaveURL("/settings?tab=members");
  await expect(page.getByRole("main").getByText(ownerEmail)).toBeVisible();
  await expect(page.getByRole("main").getByText(memberEmail)).toBeVisible();
  await expect(page.getByRole("main").getByText("Member E2E (you)")).toBeVisible();

  // The invitee is a plain member, so they shouldn't see member-management
  // controls (role dropdowns / invite form) at all.
  await expect(page.getByRole("heading", { name: "Invite a member", exact: true })).not.toBeVisible();
});

test("owner promotes a member to admin and then removes them", async ({ page }) => {
  const ownerEmail = `e2e-org-owner2-${crypto.randomUUID()}@example.com`;
  const memberEmail = `e2e-org-member2-${crypto.randomUUID()}@example.com`;
  const orgName = `E2E Org ${crypto.randomUUID()}`;

  await page.goto("/signup");
  await signUpThroughUi(page, { name: "Owner E2E", email: ownerEmail, password: "correcthorsebattery" });
  await page.goto("/settings");
  await page.getByPlaceholder("Organization name").fill(orgName);
  await page.getByRole("button", { name: "Create organization", exact: true }).click();
  await expect(page.getByRole("heading", { name: orgName, exact: true })).toBeVisible();

  const ownerOrgRow = await ownerOrg(ownerEmail);

  // Same rationale as above: insert the member row directly (a real DB
  // write) instead of round-tripping through a real invite email, since
  // this test's own purpose is role management, not the invite-acceptance
  // path already covered by the first test in this file.
  const memberSignupResponse = await page.request.post("/api/auth/sign-up/email", {
    data: { email: memberEmail, password: "correcthorsebattery", name: "Member E2E" },
    headers: { origin: APP_URL },
  });
  if (memberSignupResponse.status() !== 200) {
    throw new Error(`Sign-up failed for ${memberEmail}: ${await memberSignupResponse.text()}`);
  }
  const memberUser = (await memberSignupResponse.json()).user;
  await addMember({ orgId: ownerOrgRow.id, userId: memberUser.id, role: "member" });

  // `page.request` shares this browser context's cookie jar with `page`
  // itself, so the sign-up call above just replaced the active session
  // (originally the owner's, from creating the org) with the new member's.
  // Sign back in as the owner to drive the rest of this test as them.
  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: APP_URL } });
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(ownerEmail);
  await page.getByPlaceholder("Password").fill("correcthorsebattery");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.goto("/settings?tab=members");
  const memberRow = page.getByRole("row").filter({ hasText: memberEmail });
  await expect(memberRow).toBeVisible();
  await memberRow.getByRole("combobox").selectOption("admin");

  await expect(async () => {
    const updated = await getMembershipForOrg(memberUser.id, ownerOrgRow.id);
    expect(updated?.membership.role).toBe("admin");
  }).toPass();

  await page.reload();
  const updatedMemberRow = page.getByRole("row").filter({ hasText: memberEmail });
  await removeMember(page, updatedMemberRow);

  await expect(page.getByRole("main").getByText(memberEmail)).not.toBeVisible();
  expect(await getMembershipForOrg(memberUser.id, ownerOrgRow.id)).toBeNull();
});
