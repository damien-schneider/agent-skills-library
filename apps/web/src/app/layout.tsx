import { env } from "@skills-agent-library/env/web";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "../index.css";
import Header from "@/shared/components/layout/header";
import Providers from "@/shared/components/layout/providers";
import { getToken } from "@/shared/lib/auth-server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_NAME = "Agents Library";
const SITE_DESCRIPTION =
  "The centralized hub for AI agent capabilities. Discover, share, and manage high-quality markdown skills for the next generation of intelligent agents.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - AI Agent Skills Repository`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "AI agents",
    "agent skills",
    "AI capabilities",
    "LLM tools",
    "agent prompts",
    "AI workflows",
    "machine learning",
    "automation",
    "AI assistant",
    "Claude skills",
    "GPT skills",
    "AI agent library",
    "markdown skills",
    "AI development",
  ],
  authors: [
    { name: "Damien Schneider", url: "https://github.com/damien-schneider" },
  ],
  creator: "Damien Schneider",
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Discover & Share AI Agent Skills`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - The Hub for AI Agent Capabilities`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - AI Agent Skills Repository`,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@damienschneider",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data is safe and required for SEO
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          type="application/ld+json"
        />
        <script
          data-website-id="7f17e230-7fa9-429f-a744-86813acf1ea9"
          defer
          src="http://self-hosted-app-umami-8d8473-37-59-125-21.traefik.me/script.js"
        />
        {process.env.NODE_ENV === "development" && (
          <Script
            crossOrigin="anonymous"
            src="//unpkg.com/react-grab/dist/index.global.js"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialToken={token}>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
