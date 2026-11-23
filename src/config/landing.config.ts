import type { LandingContent } from "@/types/config";

/**
 * Landing page copy, rendered by whichever archetype `layout.config.ts`
 * selects. Replace it with your own product's — every slot reads from here.
 */
export const landingContent: LandingContent = {
  hero: {
    eyebrow: "Next.js starter for SaaS products",
    headline: "Ship the product, not the plumbing.",
    subheadline:
      "Auth, organizations and teammate invites are already wired and tested — so your first week goes into the thing only you can build.",
    primaryCta: { label: "Get started", href: "/signup" },
    secondaryCta: { label: "Sign in", href: "/login" },
    highlights: [
      "Passkeys and MFA",
      "Multi-tenant by default",
    ],
  },
  features: {
    heading: "Everything below the line is done",
    subheading: "The parts every SaaS needs and nobody wants to rebuild, built to production standards.",
    items: [
      {
        icon: "shield",
        title: "Complete authentication",
        description: "Email and password, magic links, Google and GitHub sign-in, passkeys and TOTP two-factor.",
      },
      {
        icon: "users",
        title: "Organizations and roles",
        description: "Invite teammates, assign owner, admin or member roles, and every query is scoped to the active org.",
      },
      {
        icon: "mail",
        title: "Transactional email",
        description: "Magic links and teammate invites through Resend, carrying your logo and colors.",
      },
      {
        icon: "layers",
        title: "Restyle without rewrites",
        description: "Colors, type and spacing come from design tokens, so a new look never means editing components.",
      },
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        question: "Can I change the design later?",
        answer:
          "Yes. Colors, type and spacing come from design tokens in one stylesheet. Change them and the whole app follows; no component edits.",
      },
      {
        question: "Is my data separated from other customers?",
        answer: "Every organization's data is scoped to that organization, and access is checked on every request.",
      },
    ],
  },
};
