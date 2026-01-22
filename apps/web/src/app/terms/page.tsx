import type { Metadata } from "next";

import Footer from "@/shared/components/layout/footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the terms and conditions for using Agents Library and its services.",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mb-12 text-muted-foreground">
            Last updated: {lastUpdated}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Acceptance of Terms
              </h2>
              <p className="mb-4 text-foreground/80">
                By accessing or using Agents Library ("the Service"), you agree
                to be bound by these Terms of Service ("Terms"). If you disagree
                with any part of these terms, you must not access or use our
                Service.
              </p>
              <p className="text-foreground/80">
                These Terms constitute a legally binding agreement between you
                and Agents Library. We reserve the right to modify these Terms
                at any time, and your continued use of the Service constitutes
                acceptance of any changes.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Description of Service
              </h2>
              <p className="mb-4 text-foreground/80">
                Agents Library is a centralized platform for discovering,
                sharing, and managing AI agent capabilities and skills. Our
                Service includes:
              </p>
              <ul className="list-inside list-disc text-foreground/80">
                <li className="mb-1">
                  A repository of markdown-formatted agent skills
                </li>
                <li className="mb-1">Tools for creating and editing skills</li>
                <li className="mb-1">
                  User accounts for saving and organizing skills
                </li>
                <li className="mb-1">Search and filtering functionality</li>
                <li>Voting and rating systems for community feedback</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                User Accounts
              </h2>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Account Creation
              </h3>
              <p className="mb-4 text-foreground/80">
                To access certain features of the Service, you must create an
                account. You are responsible for:
              </p>
              <ul className="mb-6 list-inside list-disc text-foreground/80">
                <li className="mb-1">Providing accurate information</li>
                <li className="mb-1">
                  Maintaining the confidentiality of your account credentials
                </li>
                <li className="mb-1">
                  All activities that occur under your account
                </li>
                <li>Notifying us immediately of unauthorized access</li>
              </ul>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Account Termination
              </h3>
              <p className="text-foreground/80">
                We reserve the right to suspend or terminate your account at any
                time for violation of these Terms or for any other reason at our
                sole discretion, with or without prior notice.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                User Content and Responsibilities
              </h2>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Content You Submit
              </h3>
              <p className="mb-4 text-foreground/80">
                When you create or contribute skills to the platform:
              </p>
              <ul className="mb-6 list-inside list-disc text-foreground/80">
                <li className="mb-1">
                  You represent that you own or have the right to use the
                  content
                </li>
                <li className="mb-1">
                  You grant us a non-exclusive, royalty-free license to use,
                  display, and distribute your content
                </li>
                <li>
                  You are responsible for the accuracy and quality of your
                  submissions
                </li>
              </ul>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Content Standards
              </h3>
              <p className="mb-4 text-foreground/80">
                You agree not to submit content that:
              </p>
              <ul className="mb-6 list-inside list-disc text-foreground/80">
                <li className="mb-1">
                  Is illegal, harmful, or promotes illegal activities
                </li>
                <li className="mb-1">
                  Infringes on intellectual property rights
                </li>
                <li className="mb-1">
                  Contains malicious code or security vulnerabilities
                </li>
                <li className="mb-1">
                  Is offensive, defamatory, or discriminatory
                </li>
                <li>Violates the privacy or rights of others</li>
              </ul>

              <h3 className="mb-2 font-medium text-foreground text-lg">
                Content Moderation
              </h3>
              <p className="text-foreground/80">
                We reserve the right to review, modify, or remove any content
                that violates these Terms or our community standards, with or
                without notice.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Intellectual Property
              </h2>
              <p className="mb-4 text-foreground/80">
                The Service and its original content, features, and
                functionality are owned by Agents Library and are protected by
                international copyright, trademark, and other intellectual
                property laws.
              </p>
              <p className="text-foreground/80">
                You may not copy, modify, distribute, or create derivative works
                from our Service without our express written permission, except
                as permitted by applicable law or these Terms.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                User Conduct
              </h2>
              <p className="mb-4 text-foreground/80">
                You agree to use the Service only for lawful purposes and in
                accordance with these Terms. You agree not to:
              </p>
              <ul className="list-inside list-disc text-foreground/80">
                <li className="mb-1">
                  Attempt to gain unauthorized access to our systems
                </li>
                <li className="mb-1">Interfere with or disrupt the Service</li>
                <li className="mb-1">
                  Use automated tools to access the Service excessively
                </li>
                <li className="mb-1">
                  Engage in spam, harassment, or abusive behavior
                </li>
                <li>
                  Reverse engineer or attempt to extract source code from the
                  Service
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Disclaimer of Warranties
              </h2>
              <p className="text-foreground/80">
                The Service is provided on an "as is" and "as available" basis
                without warranties of any kind, either express or implied. We
                disclaim all warranties, including but not limited to implied
                warranties of merchantability, fitness for a particular purpose,
                and non-infringement. We do not warrant that the Service will be
                uninterrupted, secure, or error-free.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Limitation of Liability
              </h2>
              <p className="text-foreground/80">
                To the maximum extent permitted by law, Agents Library shall not
                be liable for any indirect, incidental, special, consequential,
                or punitive damages, including without limitation, loss of
                profits, data, use, goodwill, or other intangible losses,
                resulting from your use of the Service.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Indemnification
              </h2>
              <p className="text-foreground/80">
                You agree to indemnify and hold harmless Agents Library and its
                affiliates, officers, agents, and employees from any claim,
                demand, or damages arising from your use of the Service or your
                violation of these Terms.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Governing Law
              </h2>
              <p className="text-foreground/80">
                These Terms shall be governed by and construed in accordance
                with applicable laws, without regard to its conflict of law
                provisions. Any disputes arising under these Terms shall be
                subject to the exclusive jurisdiction of the courts in the
                relevant jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-semibold text-2xl text-foreground">
                Contact Information
              </h2>
              <p className="mb-4 text-foreground/80">
                If you have any questions about these Terms of Service, please
                contact us:
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
