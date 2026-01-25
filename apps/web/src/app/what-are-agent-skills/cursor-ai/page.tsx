import { env } from "@skills-agent-library/env/web";
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "Cursor AI Skills | Agent Skills for Cursor Code Editor",
  description:
    "Discover Cursor AI agent skills to enhance your coding experience. Learn how to use rules, custom instructions, and AI features in Cursor's intelligent code editor.",
  keywords: [
    "Cursor AI skills",
    "Cursor code editor",
    "Cursor rules",
    "Cursor AI agent",
    "Cursor custom instructions",
    "AI code editor skills",
    "Cursor capabilities",
    "Cursor automation",
    "agent skills Cursor",
    "Cursor AI library",
  ],
  openGraph: {
    type: "article",
    title: "Cursor AI Skills | Agent Skills for Cursor Code Editor",
    description:
      "Discover Cursor AI agent skills to enhance your coding experience with intelligent assistance.",
    url: `${SITE_URL}/what-are-agent-skills/cursor-ai`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Cursor AI Skills | Agent Skills Library",
    description:
      "Enhance Cursor AI with customizable skills for better coding workflows.",
  },
  alternates: {
    canonical: `${SITE_URL}/what-are-agent-skills/cursor-ai`,
  },
};

const cursorFeatures = [
  {
    title: "AI Autocomplete",
    description:
      "Intelligent code completion that understands context and predicts entire code blocks.",
  },
  {
    title: "Cursor Rules",
    description:
      "Project-specific guidelines in .cursorrules files that customize AI behavior.",
  },
  {
    title: "Chat Interface",
    description:
      "Conversational AI assistant that can explain, refactor, and write code inline.",
  },
  {
    title: "Codebase Context",
    description:
      "AI that understands your entire project structure for more relevant suggestions.",
  },
];

const ruleExamples = [
  {
    name: "Framework Conventions",
    description:
      "Specify your preferred framework patterns, component structures, and coding styles.",
    example: "Always use React Server Components when possible",
  },
  {
    name: "Code Generation Style",
    description:
      "Define how AI should write code, including naming conventions and formatting.",
    example: "Use TypeScript with explicit return types",
  },
  {
    name: "Testing Requirements",
    description:
      "Set expectations for test generation and coverage requirements.",
    example: "Generate unit tests using Vitest with AAA pattern",
  },
  {
    name: "Documentation Standards",
    description: "Establish how comments and documentation should be written.",
    example: "Use JSDoc for all exported functions",
  },
];

export default function CursorAISkillsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center gap-2 text-muted-foreground text-sm">
          <li>
            <Link className="hover:text-foreground" href="/">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link
              className="hover:text-foreground"
              href="/what-are-agent-skills"
            >
              Agent Skills
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground">Cursor AI</li>
        </ol>
      </nav>

      {/* Hero Section */}
      <section className="mb-16">
        <h1
          className="mb-6 font-bold text-4xl tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cursor AI Skills
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Cursor is an AI-native code editor built on VS Code that integrates AI
          deeply into the development experience. Learn how to customize Cursor
          with agent skills for your specific workflow needs.
        </p>
      </section>

      {/* What is Cursor Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          What is Cursor AI?
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            <strong className="text-foreground">Cursor</strong> is a fork of
            Visual Studio Code enhanced with AI capabilities throughout the
            editor. Unlike traditional AI coding assistants that feel like
            add-ons, Cursor integrates AI as a first-class feature of the
            editing experience.
          </p>
          <p>
            The editor supports{" "}
            <strong className="text-foreground">agent skills</strong> through
            its rules system, allowing developers to customize how the AI
            understands and works with their codebase. This makes Cursor
            particularly powerful for teams with specific coding standards.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cursor Agent Features
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {cursorFeatures.map((feature) => (
            <div
              className="rounded-xl border border-border/50 bg-card p-5"
              key={feature.title}
            >
              <h3 className="mb-2 font-medium">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Cursor Rules Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cursor Rules: Defining Agent Skills
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Cursor Rules are the primary way to define agent skills in Cursor.
            By creating a{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              .cursorrules
            </code>{" "}
            file in your project root, you can specify instructions that the AI
            will follow when generating and modifying code.
          </p>
          <p>
            These rules act as persistent context that shapes every AI
            interaction, ensuring consistency across your development workflow.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border/50 bg-muted/30 p-6">
          <h3 className="mb-3 font-medium">Example .cursorrules File</h3>
          <pre className="overflow-x-auto text-muted-foreground text-sm">
            {`# Project: E-commerce Platform

## Tech Stack
- Next.js 14 with App Router
- TypeScript (strict mode)
- Tailwind CSS
- Prisma ORM

## Code Guidelines
- Use server components by default
- Implement error boundaries for client components
- Always validate user input with Zod
- Write accessible HTML with proper ARIA labels

## File Organization
- Keep components under 200 lines
- Colocate tests with source files
- Use barrel exports sparingly`}
          </pre>
        </div>
      </section>

      {/* Rule Examples Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cursor AI Skill Examples
        </h2>
        <div className="space-y-4">
          {ruleExamples.map((rule) => (
            <div
              className="rounded-xl border border-border/50 bg-card p-5"
              key={rule.name}
            >
              <h3 className="mb-2 font-medium">{rule.name}</h3>
              <p className="mb-3 text-muted-foreground text-sm">
                {rule.description}
              </p>
              <code className="block rounded bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                {rule.example}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Cursor vs Other AI Coding Tools
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            While tools like{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/what-are-agent-skills/claude-code"
            >
              Claude Code
            </Link>{" "}
            work as CLI tools and{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/what-are-agent-skills/windsurf"
            >
              Windsurf
            </Link>{" "}
            offers cascading flow features, Cursor focuses on deep IDE
            integration with seamless inline editing.
          </p>
          <p>
            The{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/"
            >
              agent skills library
            </Link>{" "}
            provides skills that can be adapted for Cursor&apos;s rules system,
            allowing you to leverage community-tested configurations for your
            projects.
          </p>
        </div>
      </section>

      {/* Related Pages Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Explore Other AI Agent Skills
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-lg"
            href="/what-are-agent-skills/claude-code"
          >
            <h3 className="mb-2 font-medium transition-colors group-hover:text-primary">
              Claude Code
            </h3>
            <p className="text-muted-foreground text-sm">
              Skills for Anthropic&apos;s coding assistant.
            </p>
          </Link>
          <Link
            className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-lg"
            href="/what-are-agent-skills/openai-agents"
          >
            <h3 className="mb-2 font-medium transition-colors group-hover:text-primary">
              OpenAI Agents
            </h3>
            <p className="text-muted-foreground text-sm">
              Skills for GPT-powered agents and assistants.
            </p>
          </Link>
          <Link
            className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-lg"
            href="/what-are-agent-skills/windsurf"
          >
            <h3 className="mb-2 font-medium transition-colors group-hover:text-primary">
              Windsurf
            </h3>
            <p className="text-muted-foreground text-sm">
              Skills for Codeium&apos;s AI IDE with cascading flows.
            </p>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="rounded-2xl border border-border/50 bg-card p-8 text-center">
        <h2
          className="mb-4 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Find Cursor AI Skills
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
          Browse the agent skills library to find rules and configurations
          optimized for Cursor AI. Enhance your AI-powered coding experience.
        </p>
        <Link
          className="inline-block rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          href="/"
        >
          Browse Cursor Skills
        </Link>
      </section>
    </main>
  );
}
