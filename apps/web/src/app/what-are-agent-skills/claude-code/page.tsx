import { env } from "@skills-agent-library/env/web";
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "Claude Code Skills | Agent Skills for Anthropic's Coding Assistant",
  description:
    "Discover Claude Code agent skills to enhance your development workflow. Learn how to use, create, and share skills for Anthropic's powerful AI coding assistant.",
  keywords: [
    "Claude Code skills",
    "Claude Code agent",
    "Anthropic Claude skills",
    "Claude AI skills",
    "Claude Code capabilities",
    "agent skills Claude",
    "Claude development assistant",
    "Claude Code customization",
    "AI coding skills",
    "Claude Code library",
  ],
  openGraph: {
    type: "article",
    title: "Claude Code Skills | Agent Skills for Anthropic's Coding Assistant",
    description:
      "Discover Claude Code agent skills to enhance your development workflow with Anthropic's AI.",
    url: `${SITE_URL}/what-are-agent-skills/claude-code`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Code Skills | AI Agent Skills Library",
    description:
      "Enhance Claude Code with customizable agent skills for better development workflows.",
  },
  alternates: {
    canonical: `${SITE_URL}/what-are-agent-skills/claude-code`,
  },
};

const claudeCodeFeatures = [
  {
    title: "CLAUDE.md Files",
    description:
      "Project-specific instructions stored in markdown files that Claude Code reads automatically to understand your codebase conventions.",
  },
  {
    title: "Slash Commands",
    description:
      "Built-in commands like /help, /status, and custom commands that trigger specific behaviors and workflows.",
  },
  {
    title: "Tool Use",
    description:
      "Claude Code can read files, write code, run terminal commands, and interact with your development environment.",
  },
  {
    title: "Context Awareness",
    description:
      "Understands your project structure, dependencies, and coding patterns to provide relevant suggestions.",
  },
];

const skillExamples = [
  {
    name: "Code Review Standards",
    description:
      "Define your team's code review checklist and have Claude Code apply it automatically.",
  },
  {
    name: "Testing Patterns",
    description:
      "Specify your preferred testing framework and patterns for consistent test generation.",
  },
  {
    name: "Git Conventions",
    description:
      "Set commit message formats, branching strategies, and PR templates.",
  },
  {
    name: "Documentation Style",
    description:
      "Establish documentation standards for consistent README and API documentation.",
  },
];

export default function ClaudeCodeSkillsPage() {
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
          <li className="text-foreground">Claude Code</li>
        </ol>
      </nav>

      {/* Hero Section */}
      <section className="mb-16">
        <h1
          className="mb-6 font-bold text-4xl tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Claude Code Skills
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Claude Code is Anthropic&apos;s AI-powered coding assistant that
          brings Claude&apos;s capabilities directly into your development
          workflow. Learn how to extend it with custom agent skills for enhanced
          productivity.
        </p>
      </section>

      {/* What is Claude Code Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          What is Claude Code?
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            <strong className="text-foreground">Claude Code</strong> is
            Anthropic&apos;s official command-line tool and IDE integration that
            enables developers to interact with Claude directly in their
            development environment. It can understand your codebase, write
            code, run commands, and help with complex software engineering
            tasks.
          </p>
          <p>
            What makes Claude Code particularly powerful is its support for{" "}
            <strong className="text-foreground">agent skills</strong> through
            configuration files like{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              CLAUDE.md
            </code>
            . These skills allow you to customize how Claude Code behaves for
            your specific project needs.
          </p>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Claude Code Agent Features
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {claudeCodeFeatures.map((feature) => (
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

      {/* How Skills Work Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          How Claude Code Skills Work
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Claude Code skills are defined through markdown files placed in your
            project. The most common approach is using a{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              CLAUDE.md
            </code>{" "}
            file at the root of your project or in a{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              .claude
            </code>{" "}
            directory.
          </p>
          <p>
            When Claude Code starts a session in your project, it automatically
            reads these configuration files and applies the instructions as
            context. This means your custom skills are always active without
            manual intervention.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border/50 bg-muted/30 p-6">
          <h3 className="mb-3 font-medium">Example CLAUDE.md Structure</h3>
          <pre className="overflow-x-auto text-muted-foreground text-sm">
            {`# Project Guidelines

## Code Style
- Use TypeScript strict mode
- Prefer functional components
- Follow ESLint rules

## Testing
- Write tests using Vitest
- Aim for 80% code coverage

## Git Conventions
- Use conventional commits
- Always include ticket numbers`}
          </pre>
        </div>
      </section>

      {/* Skill Examples Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Example Claude Code Skills
        </h2>
        <div className="space-y-4">
          {skillExamples.map((skill) => (
            <div
              className="flex gap-4 rounded-xl border border-border/50 bg-card p-5"
              key={skill.name}
            >
              <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <h3 className="mb-1 font-medium">{skill.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {skill.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Integrating Skills from the Agent Skills Library
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            The{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/"
            >
              Agents Library
            </Link>{" "}
            provides a curated collection of skills specifically designed for
            Claude Code. You can browse, preview, and install skills directly
            into your project.
          </p>
          <p>
            Each skill in the library includes installation instructions,
            compatibility information, and examples of how it enhances Claude
            Code&apos;s behavior in different scenarios.
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
            href="/what-are-agent-skills/cursor-ai"
          >
            <h3 className="mb-2 font-medium transition-colors group-hover:text-primary">
              Cursor AI
            </h3>
            <p className="text-muted-foreground text-sm">
              Skills for Cursor&apos;s AI-native code editor.
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
          Find Claude Code Skills
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
          Browse the agent skills library to find skills optimized for Claude
          Code. Enhance your AI-assisted development workflow today.
        </p>
        <Link
          className="inline-block rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          href="/"
        >
          Browse Claude Code Skills
        </Link>
      </section>
    </main>
  );
}
