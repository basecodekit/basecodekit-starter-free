import { Resend } from "resend";
import { MagicLinkEmail } from "@/emails/magic-link";
import { OrgInviteEmail } from "@/emails/org-invite";
import { VerifyEmail } from "@/emails/verify-email";
import { siteConfig } from "@/config/site.config";
import { brand } from "@/core/brand";

let resend: Resend | undefined;

function getResendClient() {
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const { error } = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    to: email,
    subject: `Sign in to ${siteConfig.name}`,
    react: MagicLinkEmail({
      url,
      siteName: siteConfig.name,
      brand: brand.email,
    }),
  });

  if (error) {
    throw new Error(`Failed to send magic link email: ${error.message}`);
  }
}

export async function sendVerifyEmail({ email, url }: { email: string; url: string }) {
  const { error } = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    to: email,
    subject: `Confirm your email for ${siteConfig.name}`,
    react: VerifyEmail({
      url,
      siteName: siteConfig.name,
      heading: "Confirm your email address",
      body: `Confirm that this is your email address for ${siteConfig.name}.`,
      buttonLabel: "Confirm email",
      brand: brand.email,
    }),
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/** Goes to the address being replaced: the change only goes on once it's approved. */
export async function sendChangeEmailApproval({ email, newEmail, url }: { email: string; newEmail: string; url: string }) {
  const { error } = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    to: email,
    subject: `Approve your email change for ${siteConfig.name}`,
    react: VerifyEmail({
      url,
      siteName: siteConfig.name,
      heading: "Approve your email change",
      body: `Your ${siteConfig.name} account is asked to move to ${newEmail}. Approve it to continue; we then send a confirmation link to the new address.`,
      buttonLabel: "Approve change",
      brand: brand.email,
    }),
  });

  if (error) {
    throw new Error(`Failed to send email change approval: ${error.message}`);
  }
}

export async function sendOrgInviteEmail({
  email,
  url,
  orgName,
  orgLogoUrl,
  inviterName,
}: {
  email: string;
  url: string;
  orgName: string;
  /** The org's uploaded logo, shown instead of the site's. */
  orgLogoUrl?: string | null;
  inviterName: string;
}) {
  const { error } = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    to: email,
    subject: `${inviterName} invited you to join ${orgName} on ${siteConfig.name}`,
    react: OrgInviteEmail({
      url,
      orgName,
      siteName: siteConfig.name,
      brand: orgLogoUrl ? { ...brand.email, logoUrl: orgLogoUrl } : brand.email,
      logoAlt: orgLogoUrl ? orgName : siteConfig.name,
      inviterName,
    }),
  });

  if (error) {
    throw new Error(`Failed to send org invite email: ${error.message}`);
  }
}

