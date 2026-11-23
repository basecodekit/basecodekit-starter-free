import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { layoutConfig } from "@/config/layout.config";
import { siteConfig } from "@/config/site.config";
import { brand } from "@/core/brand";
import { themeInitScript } from "@/core/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes the generated share image's URL absolute, as crawlers require.
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.name,
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: `themeInitScript` may set `data-theme` on
    // <html> before React hydrates it.
    <html
      lang="en"
      suppressHydrationWarning
      data-style-pack={layoutConfig.stylePack}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* The visitor's light/dark choice, applied before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Whitelabel color overrides; values are format-checked in core/brand. */}
        {brand.css && <style id="brand-tokens">{brand.css}</style>}
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
