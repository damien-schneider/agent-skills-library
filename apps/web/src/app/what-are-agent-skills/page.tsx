import { env } from "@skills-agent-library/env/web";
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "What Are Agent Skills? | Complete Guide to AI Agent Skills Library",
  description:
    "Learn what agent skills are and how they enhance AI assistants like Claude Code, OpenAI GPT, Cursor AI, and Windsurf. Discover the comprehensive agent skills library for building smarter AI workflows.",
  keywords: [
    "agent skills",
    "agent skills library",
    "AI agent skills",
    "what are agent skills",
    "Claude Code skills",
    "OpenAI agent skills",
    "Cursor AI skills",
    "Windsurf skills",
    "AI assistant capabilities",
    "LLM skills",
    "AI automation",
    "agent prompts",
  ],
  openGraph: {
    type: "article",
    title: "What Are Agent Skills? | Complete Guide to AI Agent Skills Library",
    description:
      "Learn what agent skills are and how they enhance AI assistants like Claude Code, OpenAI GPT, Cursor AI, and Windsurf.",
    url: `${SITE_URL}/what-are-agent-skills`,
  },
  twitter: {
    card: "summary_large_image",
    title: "What Are Agent Skills? | AI Agent Skills Library Guide",
    description:
      "Comprehensive guide to agent skills and how they power modern AI assistants.",
  },
  alternates: {
    canonical: `${SITE_URL}/what-are-agent-skills`,
  },
};

const agentPlatforms = [
  {
    name: "Claude Code",
    href: "/what-are-agent-skills/claude-code",
    description:
      "Anthropic's powerful coding assistant with customizable skills for development workflows.",
  },
  {
    name: "OpenAI Agents",
    href: "/what-are-agent-skills/openai-agents",
    description:
      "GPT-powered agents with tool use and custom instructions for diverse tasks.",
  },
  {
    name: "Cursor AI",
    href: "/what-are-agent-skills/cursor-ai",
    description:
      "AI-native code editor with intelligent autocomplete and skill-based enhancements.",
  },
  {
    name: "Windsurf",
    href: "/what-are-agent-skills/windsurf",
    description:
      "Codeium's AI IDE with cascading flows and agent-powered development features.",
  },
];

const skillCategories = [
  {
    title: "Development Skills",
    description:
      "Code generation, debugging, refactoring, and test writing capabilities.",
    icon: "🛠️",
  },
  {
    title: "Documentation Skills",
    description:
      "README generation, API documentation, and technical writing assistance.",
    icon: "📝",
  },
  {
    title: "Analysis Skills",
    description:
      "Code review, security auditing, and performance optimization analysis.",
    icon: "🔍",
  },
  {
    title: "Workflow Skills",
    description:
      "Git operations, CI/CD integration, and deployment automation.",
    icon: "⚙️",
  },
];

export default function WhatAreAgentSkillsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero Section */}
      <section className="mb-16 text-center">
        <h1
          className="mb-6 font-bold text-4xl tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          What Are Agent Skills?
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Agent skills are reusable capabilities that enhance AI assistants,
          enabling them to perform specialized tasks with greater precision and
          efficiency across development workflows.
        </p>
      </section>

      {/* Definition Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Understanding the Agent Skills Library
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            An <strong className="text-foreground">agent skills library</strong>{" "}
            is a curated collection of predefined capabilities that AI agents
            can use to perform specific tasks. Think of skills as modular
            building blocks that extend what an AI assistant can do beyond its
            base training.
          </p>
          <p>
            When you add a skill to an AI agent like{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/what-are-agent-skills/claude-code"
            >
              Claude Code
            </Link>{" "}
            or{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/what-are-agent-skills/cursor-ai"
            >
              Cursor AI
            </Link>
            , you&apos;re essentially giving it specialized knowledge and
            instructions for handling particular scenarios. This makes the agent
            more effective at domain-specific tasks.
          </p>
          <p>
            The{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/"
            >
              Agents Library
            </Link>{" "}
            serves as a centralized hub where developers can discover, share,
            and manage these high-quality skills for the next generation of
            intelligent AI agents.
          </p>
        </div>
      </section>

      {/* How Skills Work Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          How Agent Skills Work
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="mb-3 font-medium text-lg">1. Skill Definition</h3>
            <p className="text-muted-foreground text-sm">
              Skills are defined using markdown files that contain instructions,
              context, and examples for the AI agent to follow when performing
              specific tasks.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="mb-3 font-medium text-lg">2. Skill Installation</h3>
            <p className="text-muted-foreground text-sm">
              Users can browse the agent skills library and install skills that
              match their needs. Installation typically involves adding the
              skill to the agent&apos;s configuration.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="mb-3 font-medium text-lg">3. Skill Activation</h3>
            <p className="text-muted-foreground text-sm">
              When an agent encounters a relevant task, it can activate the
              appropriate skill, using the predefined instructions to guide its
              response.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="mb-3 font-medium text-lg">4. Skill Composition</h3>
            <p className="text-muted-foreground text-sm">
              Multiple skills can be combined to create powerful workflows,
              allowing agents to handle complex, multi-step tasks with
              specialized knowledge.
            </p>
          </div>
        </div>
      </section>

      {/* Skill Categories Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Types of Agent Skills
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {skillCategories.map((category) => (
            <div
              className="flex gap-4 rounded-xl border border-border/50 bg-card p-5"
              key={category.title}
            >
              <span className="text-2xl">{category.icon}</span>
              <div>
                <h3 className="mb-1 font-medium">{category.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {category.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Platforms Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Agent Skills for Popular AI Platforms
        </h2>
        <p className="mb-6 text-muted-foreground">
          Different AI platforms support skills in various ways. Explore how
          agent skills work with these popular AI coding assistants:
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {agentPlatforms.map((platform) => (
            <Link
              className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-lg"
              href={platform.href}
              key={platform.name}
            >
              <h3 className="mb-2 font-medium transition-colors group-hover:text-primary">
                {platform.name} Skills
              </h3>
              <p className="text-muted-foreground text-sm">
                {platform.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Benefits of Using an Agent Skills Library
        </h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="mt-1 text-primary">•</span>
            <span>
              <strong className="text-foreground">Consistency:</strong> Skills
              ensure agents follow best practices and coding standards across
              your team.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 text-primary">•</span>
            <span>
              <strong className="text-foreground">Efficiency:</strong> Pre-built
              skills eliminate the need to repeatedly explain complex
              requirements to AI agents.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 text-primary">•</span>
            <span>
              <strong className="text-foreground">Shareability:</strong> Teams
              can share skills to ensure everyone benefits from optimized agent
              configurations.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 text-primary">•</span>
            <span>
              <strong className="text-foreground">Specialization:</strong>{" "}
              Domain-specific skills make agents more effective at specialized
              tasks.
            </span>
          </li>
        </ul>
      </section>

      {/* CTA Section */}
      <section className="rounded-2xl border border-border/50 bg-card p-8 text-center">
        <h2
          className="mb-4 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Explore the Agent Skills Library
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
          Browse hundreds of community-contributed skills for AI agents.
          Discover, install, and share skills to enhance your development
          workflow.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
            href="/"
          >
            Browse Skills
          </Link>
          <Link
            className="rounded-lg border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
            href="/skills/new"
          >
            Create a Skill
          </Link>
        </div>
      </section>
    </main>
  );
}
