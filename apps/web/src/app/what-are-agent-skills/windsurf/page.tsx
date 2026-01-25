import { env } from "@skills-agent-library/env/web";
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "Windsurf Skills | Agent Skills for Codeium's AI IDE",
  description:
    "Discover Windsurf agent skills for Codeium's AI-powered IDE. Learn about Cascade flows, AI commands, and how to customize Windsurf for your development workflow.",
  keywords: [
    "Windsurf skills",
    "Windsurf AI",
    "Codeium Windsurf",
    "Windsurf IDE",
    "Cascade AI",
    "Windsurf agent skills",
    "Windsurf capabilities",
    "AI IDE skills",
    "Windsurf customization",
    "Codeium agent library",
  ],
  openGraph: {
    type: "article",
    title: "Windsurf Skills | Agent Skills for Codeium's AI IDE",
    description:
      "Discover Windsurf agent skills for Codeium's AI-powered IDE with Cascade flows.",
    url: `${SITE_URL}/what-are-agent-skills/windsurf`,
  },
  twitter: {
    card: "summary_large_image",
    title: "Windsurf Skills | Agent Skills Library",
    description:
      "Enhance Windsurf AI with customizable skills for better development workflows.",
  },
  alternates: {
    canonical: `${SITE_URL}/what-are-agent-skills/windsurf`,
  },
};

const windsurfFeatures = [
  {
    title: "Cascade",
    description:
      "Agentic AI system that can execute multi-step coding tasks autonomously across your codebase.",
  },
  {
    title: "Supercomplete",
    description:
      "Advanced autocomplete that predicts your next actions and suggests entire code transformations.",
  },
  {
    title: "AI Commands",
    description:
      "Natural language commands that trigger code generation, refactoring, and file operations.",
  },
  {
    title: "Context Engine",
    description:
      "Intelligent indexing of your codebase for deep understanding of project structure and patterns.",
  },
];

const cascadeCapabilities = [
  {
    name: "Multi-file Editing",
    description:
      "Cascade can make coordinated changes across multiple files while maintaining consistency.",
  },
  {
    name: "Terminal Integration",
    description:
      "Execute commands, run tests, and manage dependencies directly through the AI.",
  },
  {
    name: "Contextual Awareness",
    description:
      "Understands your current task context and suggests relevant next steps.",
  },
  {
    name: "Memory",
    description:
      "Remembers your project context and previous interactions for more coherent assistance.",
  },
];

const skillExamples = [
  {
    title: "Project Rules",
    description:
      "Define coding standards and conventions that Cascade follows when generating code.",
    icon: "📋",
  },
  {
    title: "Workflow Automation",
    description:
      "Create reusable flows for common tasks like component creation or API integration.",
    icon: "🔄",
  },
  {
    title: "Testing Patterns",
    description:
      "Specify how tests should be structured and what coverage expectations to maintain.",
    icon: "🧪",
  },
  {
    title: "Documentation Style",
    description:
      "Set preferences for inline comments, docstrings, and README generation.",
    icon: "📝",
  },
];

export default function WindsurfSkillsPage() {
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
          <li className="text-foreground">Windsurf</li>
        </ol>
      </nav>

      {/* Hero Section */}
      <section className="mb-16">
        <h1
          className="mb-6 font-bold text-4xl tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Windsurf Skills
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Windsurf is Codeium&apos;s AI-native IDE featuring Cascade, an agentic
          AI system capable of executing complex, multi-step coding tasks. Learn
          how to enhance Windsurf with custom agent skills.
        </p>
      </section>

      {/* What is Windsurf Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          What is Windsurf?
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            <strong className="text-foreground">Windsurf</strong> is an
            AI-powered IDE developed by Codeium, the company known for their
            free AI code completion tools. Unlike traditional editors with AI
            add-ons, Windsurf was built from the ground up with agentic AI
            capabilities.
          </p>
          <p>
            The standout feature is{" "}
            <strong className="text-foreground">Cascade</strong>,
            Windsurf&apos;s AI agent that can autonomously execute multi-step
            coding tasks. This makes it particularly powerful for complex
            refactoring, feature implementation, and codebase-wide changes.
          </p>
          <p>
            Like other modern AI coding tools, Windsurf supports{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/what-are-agent-skills"
            >
              agent skills
            </Link>{" "}
            that customize how the AI understands and works with your specific
            project needs.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Windsurf Agent Features
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {windsurfFeatures.map((feature) => (
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

      {/* Cascade Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Understanding Cascade AI
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Cascade represents Windsurf&apos;s approach to agentic AI coding.
            Unlike simpler chat interfaces, Cascade can plan and execute complex
            tasks that span multiple files and require sequential operations.
          </p>
          <p>
            When you give Cascade a task, it analyzes your codebase, creates an
            execution plan, and carries it out step by step while keeping you
            informed of its progress.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {cascadeCapabilities.map((capability) => (
            <div
              className="flex gap-3 rounded-xl border border-border/50 bg-card p-4"
              key={capability.name}
            >
              <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <h3 className="mb-1 font-medium text-sm">{capability.name}</h3>
                <p className="text-muted-foreground text-xs">
                  {capability.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills Configuration Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Configuring Windsurf Skills
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Windsurf supports project-level configurations that act as agent
            skills. These configurations tell Cascade how to approach your
            specific project, including coding standards, testing requirements,
            and architectural patterns.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {skillExamples.map((skill) => (
            <div
              className="flex gap-4 rounded-xl border border-border/50 bg-card p-5"
              key={skill.title}
            >
              <span className="text-2xl">{skill.icon}</span>
              <div>
                <h3 className="mb-1 font-medium">{skill.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {skill.description}
                </p>
              </div>
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
          Windsurf vs Other AI Coding Tools
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="p-3 text-left font-medium">Feature</th>
                <th className="p-3 text-left font-medium">Windsurf</th>
                <th className="p-3 text-left font-medium">Cursor</th>
                <th className="p-3 text-left font-medium">Claude Code</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-border/50 border-b">
                <td className="p-3">Agentic Tasks</td>
                <td className="p-3">Cascade</td>
                <td className="p-3">Composer</td>
                <td className="p-3">CLI Agent</td>
              </tr>
              <tr className="border-border/50 border-b">
                <td className="p-3">Multi-file Editing</td>
                <td className="p-3">Native</td>
                <td className="p-3">Supported</td>
                <td className="p-3">Supported</td>
              </tr>
              <tr className="border-border/50 border-b">
                <td className="p-3">Skills Config</td>
                <td className="p-3">Project Rules</td>
                <td className="p-3">.cursorrules</td>
                <td className="p-3">CLAUDE.md</td>
              </tr>
              <tr>
                <td className="p-3">IDE Type</td>
                <td className="p-3">Standalone</td>
                <td className="p-3">VS Code Fork</td>
                <td className="p-3">CLI + IDE Plugins</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-muted-foreground text-sm">
          Each tool has its strengths. The{" "}
          <Link
            className="text-foreground underline underline-offset-4 hover:text-primary"
            href="/"
          >
            agent skills library
          </Link>{" "}
          provides skills that can be adapted for any of these platforms.
        </p>
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
            href="/what-are-agent-skills/cursor-ai"
          >
            <h3 className="mb-2 font-medium transition-colors group-hover:text-primary">
              Cursor AI
            </h3>
            <p className="text-muted-foreground text-sm">
              Skills for Cursor&apos;s AI-native code editor.
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
          Discover Windsurf Skills
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
          Browse the agent skills library to find configurations and rules
          optimized for Windsurf. Enhance your Cascade AI experience.
        </p>
        <Link
          className="inline-block rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          href="/"
        >
          Browse Windsurf Skills
        </Link>
      </section>
    </main>
  );
}
