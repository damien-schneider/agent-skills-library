import type { Metadata } from "next";

import Footer from "@/shared/components/layout/footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Agents Library collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  const lastUpdated = new Date("2025-01-01").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-linear-to-b from-background via-background to-muted/20" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(99,102,241,0.03) 0%, transparent 70%)",
          }}
        />
      </div>

      <main className="relative z-10">
        <div className="mx-auto max-w-4xl px-4 py-24 md:py-32">
          <h1
            className="mb-4 text-4xl text-foreground md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Privacy Policy
          </h1>
          <p className="mb-12 text-muted-foreground">
            Last updated: {lastUpdated}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Introduction
              </h2>
              <p className="mb-4 text-foreground/80">
                Welcome to Agents Library ("we," "our," or "us"). This Privacy
                Policy explains how we collect, use, disclose, and safeguard
                your information when you use our website and services.
              </p>
              <p className="text-foreground/80">
                By using Agents Library, you consent to the data practices
                described in this policy. If you do not agree with the terms of
                this privacy policy, please do not access or use our services.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Information We Collect
              </h2>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Personal Information
              </h3>
              <p className="mb-4 text-foreground/80">
                When you create an account, we collect information that you
                provide directly to us, including:
              </p>
              <ul className="mb-6 list-inside list-disc text-foreground/80">
                <li className="mb-1">Email address</li>
                <li className="mb-1">Name (optional)</li>
                <li>Authentication credentials</li>
              </ul>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Usage Information
              </h3>
              <p className="mb-4 text-foreground/80">
                We automatically collect information about your interactions
                with our services, including:
              </p>
              <ul className="mb-6 list-inside list-disc text-foreground/80">
                <li className="mb-1">Pages you visit</li>
                <li className="mb-1">
                  Skills you create, save, or interact with
                </li>
                <li className="mb-1">Search queries and filters</li>
                <li>IP address and browser type</li>
              </ul>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Cookies and Tracking
              </h3>
              <p className="text-foreground/80">
                We use cookies and similar tracking technologies to enhance your
                experience, analyze usage patterns, and improve our services.
                You can control cookie settings through your browser
                preferences.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                How We Use Your Information
              </h2>
              <p className="mb-4 text-foreground/80">
                We use the information we collect to:
              </p>
              <ul className="list-inside list-disc text-foreground/80">
                <li className="mb-1">
                  Provide, maintain, and improve our services
                </li>
                <li className="mb-1">
                  Create and manage your account and skills
                </li>
                <li className="mb-1">
                  Authenticate your identity and secure your account
                </li>
                <li className="mb-1">
                  Analyze usage patterns and improve user experience
                </li>
                <li className="mb-1">
                  Send you important communications about our services
                </li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Data Sharing and Disclosure
              </h2>
              <p className="mb-4 text-foreground/80">
                We do not sell your personal information. We may share your
                information only in the following circumstances:
              </p>
              <ul className="list-inside list-disc text-foreground/80">
                <li className="mb-1">
                  <strong>Service Providers:</strong> We engage trusted third
                  parties to perform services on our behalf (e.g., hosting,
                  analytics)
                </li>
                <li className="mb-1">
                  <strong>Legal Requirements:</strong> We may disclose
                  information if required by law or to protect our rights
                </li>
                <li className="mb-1">
                  <strong>Business Transfers:</strong> In connection with a
                  merger, sale, or transfer of assets
                </li>
                <li>
                  <strong>Public Content:</strong> Skills you publish are
                  publicly visible and accessible
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Data Security
              </h2>
              <p className="text-foreground/80">
                We implement appropriate technical and organizational measures
                to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction. However, no
                method of transmission over the internet is 100% secure, and we
                cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Your Rights
              </h2>
              <p className="mb-4 text-foreground/80">
                You have certain rights regarding your personal information:
              </p>
              <ul className="list-inside list-disc text-foreground/80">
                <li className="mb-1">Access to your personal data</li>
                <li className="mb-1">Correction of inaccurate data</li>
                <li className="mb-1">Deletion of your account and data</li>
                <li className="mb-1">Objection to processing of your data</li>
                <li>Data portability (transfer to another service)</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Children's Privacy
              </h2>
              <p className="text-foreground/80">
                Our services are not intended for children under the age of 13.
                We do not knowingly collect personal information from children
                under 13. If you become aware that a child has provided us with
                personal information, please contact us.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Changes to This Policy
              </h2>
              <p className="text-foreground/80">
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new policy on this page
                and updating the "Last updated" date. You are advised to review
                this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Contact Us
              </h2>
              <p className="mb-4 text-foreground/80">
                If you have any questions, concerns, or requests regarding this
                Privacy Policy or our data practices, please contact us at:
              </p>
              <a
                className="text-primary hover:underline"
                href="mailto:contact@agentslibrary.com"
              >
                contact@agentslibrary.com
              </a>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
