import { expect, test } from "@playwright/test";
import { createInvite, findOrganizationByOwner, findPendingInvite, findUserByEmail } from "@/db/repo";
import { APP_URL } from "@/lib/env";
import { needsEmailPassword, openInviteForm, signUpThroughUi } from "./helpers";

// The whole product in one pass, as a new customer meets it. Each step is
// covered in depth by its own spec; this one proves they still connect.
//
// Steps that reach outside the app run for real only when their keys are
// configured, as they are in local dev:
// - The invite is sent through the UI when Resend is configured, to Resend's
//   test inbox. Otherwise it's created in the database, as e2e/org.spec.ts
//   does, and the rest of the flow is the same.

test.skip(...needsEmailPassword);
// One test through every route: in dev mode each compiles on first hit.
test.setTimeout(120_000);

const PASSWORD = "correcthorsebattery";
const hasResend = Boolean(process.env.RESEND_API_KEY);


test("signup → create org → invite member", async ({ page }) => {
  const id = crypto.randomUUID();
  const ownerEmail = `e2e-golden-owner-${id}@example.com`;
  const memberEmail = hasResend ? `delivered+golden-${id}@resend.dev` : `e2e-golden-member-${id}@example.com`;
  const orgName = `Golden ${id}`;

  // 1. Sign up.
  await page.goto("/signup");
  await signUpThroughUi(page, { name: "Golden Owner", email: ownerEmail, password: PASSWORD });
  await expect(page).toHaveURL("/dashboard");

  // 2. Create the org.
  await page.goto("/settings");
  await page.getByPlaceholder("Organization name").fill(orgName);
  await page.getByRole("button", { name: "Create organization", exact: true }).click();
  await expect(page.getByRole("heading", { name: orgName, exact: true })).toBeVisible();
  const owner = await findUserByEmail(ownerEmail);
  const org = owner && (await findOrganizationByOwner(owner.id));
  expect(org).toBeTruthy();


  // 4. Invite a member, who signs up and accepts.
  let inviteToken: string;
  if (hasResend) {
    await page.goto("/settings?tab=members");
    await openInviteForm(page);
    await page.getByPlaceholder("Email", { exact: true }).fill(memberEmail);
    await page.getByRole("button", { name: "Send invite", exact: true }).click();
    await expect(page.getByText(`Invite sent to ${memberEmail}.`)).toBeVisible();
    // Stands in for opening the email.
    const invite = await findPendingInvite(org!.id, memberEmail);
    expect(invite).toBeTruthy();
    inviteToken = invite!.token;
  } else {
    const invite = await createInvite({
      orgId: org!.id,
      email: memberEmail,
      role: "member",
      invitedByUserId: owner!.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    inviteToken = invite.token;
  }

  await page.request.post("/api/auth/sign-out", { data: {}, headers: { origin: APP_URL } });
  await page.goto("/signup");
  await signUpThroughUi(page, { name: "Golden Member", email: memberEmail, password: PASSWORD });
  await page.goto(`/invite/${inviteToken}`);
  await page.getByRole("button", { name: "Accept invite", exact: true }).click();
  await expect(page).toHaveURL("/settings?tab=members");
  await expect(page.getByRole("heading", { name: orgName, exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText("Golden Member (you)")).toBeVisible();
  await expect(page.getByRole("main").getByText(ownerEmail)).toBeVisible();

});
