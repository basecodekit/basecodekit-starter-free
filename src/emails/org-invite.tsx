import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { DEFAULT_EMAIL_BRAND, EmailLogo, type EmailBrand } from "./brand";

interface OrgInviteEmailProps {
  url: string;
  orgName: string;
  siteName: string;
  brand?: EmailBrand;
  /** Alt text for the logo; defaults to `siteName`. */
  logoAlt?: string;
  inviterName: string;
}

export function OrgInviteEmail({
  url,
  orgName,
  siteName,
  brand = DEFAULT_EMAIL_BRAND,
  logoAlt = siteName,
  inviterName,
}: OrgInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {orgName} on {siteName}
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <EmailLogo brand={brand} alt={logoAlt} />
          <Heading style={{ fontSize: "20px" }}>
            You&apos;re invited to {orgName}
          </Heading>
          <Text style={{ fontSize: "14px", color: "#3f3f46" }}>
            {inviterName} invited you to join <strong>{orgName}</strong> on{" "}
            {siteName}. Click the button below to accept. This invite expires in
            7 days.
          </Text>
          <Button
            href={url}
            style={{
              backgroundColor: brand.primary,
              color: brand.primaryForeground,
              padding: "12px 20px",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            Accept invite
          </Button>
          <Text style={{ fontSize: "12px", color: "#71717a" }}>
            If you weren&apos;t expecting this invite, you can safely ignore
            this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
