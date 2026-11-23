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

interface VerifyEmailProps {
  url: string;
  siteName: string;
  heading: string;
  body: string;
  buttonLabel: string;
  brand?: EmailBrand;
}

/** One layout for the account's email-address mails: confirming a new
 * address, and approving the change from the old one. */
export function VerifyEmail({
  url,
  siteName,
  heading,
  body,
  buttonLabel,
  brand = DEFAULT_EMAIL_BRAND,
}: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{heading}</Preview>
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
          <Heading style={{ fontSize: "20px" }}>{heading}</Heading>
          <Text style={{ fontSize: "14px", color: "#3f3f46" }}>{body}</Text>
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
            {buttonLabel}
          </Button>
          <Text style={{ fontSize: "12px", color: "#71717a" }}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
