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

interface MagicLinkEmailProps {
  url: string;
  siteName: string;
  brand?: EmailBrand;
}

export function MagicLinkEmail({
  url,
  siteName,
  brand = DEFAULT_EMAIL_BRAND,
}: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to {siteName}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: "480px",
          }}
        >
          <EmailLogo brand={brand} alt={siteName} />
          <Heading style={{ fontSize: "20px" }}>Sign in to {siteName}</Heading>
          <Text style={{ fontSize: "14px", color: "#3f3f46" }}>
            Click the button below to sign in. This link expires shortly and can
            only be used once.
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
            Sign in
          </Button>
          <Text style={{ fontSize: "12px", color: "#71717a" }}>
            If you didn&apos;t request this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
