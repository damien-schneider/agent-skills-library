import { env } from "@skills-agent-library/env/web";
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: "OpenAI Agent Skills | GPT Custom Instructions & Capabilities",
  description:
    "Learn about OpenAI agent skills for ChatGPT and GPT models. Discover how to use custom instructions, GPTs, and the Assistants API to create powerful AI agent workflows.",
  keywords: [
    "OpenAI agent skills",
    "GPT skills",
    "ChatGPT skills",
    "OpenAI custom instructions",
    "GPT capabilities",
    "OpenAI Assistants API",
    "GPT agent library",
    "custom GPTs",
    "AI agent OpenAI",
    "GPT automation",
  ],
  openGraph: {
    type: "article",
    title: "OpenAI Agent Skills | GPT Custom Instructions & Capabilities",
    description:
      "Learn about OpenAI agent skills for ChatGPT and GPT models with custom instructions.",
    url: `${SITE_URL}/what-are-agent-skills/openai-agents`,
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenAI Agent Skills | Agent Skills Library",
    description:
      "Discover how to enhance GPT models with custom agent skills and instructions.",
  },
  alternates: {
    canonical: `${SITE_URL}/what-are-agent-skills/openai-agents`,
  },
};

const openAIFeatures = [
  {
    title: "Custom Instructions",
    description:
      "Persistent instructions that shape how ChatGPT responds across all conversations.",
  },
  {
    title: "GPT Builder",
    description:
      "Create custom GPTs with specific knowledge, capabilities, and conversation styles.",
  },
  {
    title: "Assistants API",
    description:
      "Build AI assistants with persistent threads, file handling, and tool integrations.",
  },
  {
    title: "Function Calling",
    description:
      "Define functions that GPT can invoke to interact with external systems and APIs.",
  },
];

const skillTypes = [
  {
    name: "System Prompts",
    description:
      "Base instructions that define the agent's personality, expertise, and response style.",
    useCase: "Creating specialized assistants for specific domains",
  },
  {
    name: "Knowledge Files",
    description:
      "Documents and data that provide the agent with specialized knowledge.",
    useCase: "Building agents with domain expertise",
  },
  {
    name: "Tool Definitions",
    description:
      "Function schemas that enable the agent to perform specific actions.",
    useCase: "Integrating with external APIs and services",
  },
  {
    name: "Code Interpreter",
    description:
      "Enables the agent to write and execute Python code for data analysis.",
    useCase: "Data processing and visualization tasks",
  },
];

export default function OpenAIAgentsPage() {
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
          <li className="text-foreground">OpenAI Agents</li>
        </ol>
      </nav>

      {/* Hero Section */}
      <section className="mb-16">
        <h1
          className="mb-6 font-bold text-4xl tracking-tight md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          OpenAI Agent Skills
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          OpenAI provides multiple ways to enhance GPT models with custom skills
          and capabilities. From custom instructions to the powerful Assistants
          API, learn how to build sophisticated AI agents with OpenAI.
        </p>
      </section>

      {/* Overview Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Understanding OpenAI Agent Capabilities
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            <strong className="text-foreground">OpenAI agents</strong> encompass
            a range of tools and APIs that allow developers to create customized
            AI experiences. Whether you&apos;re using ChatGPT with custom
            instructions or building complex assistants with the API, agent
            skills define how your AI behaves and responds.
          </p>
          <p>
            The{" "}
            <Link
              className="text-foreground underline underline-offset-4 hover:text-primary"
              href="/what-are-agent-skills"
            >
              agent skills library
            </Link>{" "}
            concept applies to OpenAI in several ways: system prompts that guide
            behavior, knowledge files that provide expertise, and tool
            definitions that enable actions.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          OpenAI Agent Features
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {openAIFeatures.map((feature) => (
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

      {/* Skill Types Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Types of OpenAI Agent Skills
        </h2>
        <div className="space-y-4">
          {skillTypes.map((skill) => (
            <div
              className="rounded-xl border border-border/50 bg-card p-5"
              key={skill.name}
            >
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h3 className="font-medium">{skill.name}</h3>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground text-xs">
                  {skill.useCase}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                {skill.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Custom GPTs Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Building Custom GPTs with Skills
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            Custom GPTs represent OpenAI&apos;s most accessible way to create
            skill-enhanced agents. Each custom GPT combines:
          </p>
          <ul className="ml-4 space-y-2">
            <li className="flex items-start gap-3">
              <span className="mt-1 text-primary">•</span>
              <span>
                <strong className="text-foreground">Instructions:</strong>{" "}
                Custom behavior guidelines that define how the GPT responds
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-primary">•</span>
              <span>
                <strong className="text-foreground">Knowledge:</strong> Uploaded
                files that provide specialized expertise
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-primary">•</span>
              <span>
                <strong className="text-foreground">Capabilities:</strong>{" "}
                Enabled features like web browsing, code execution, or image
                generation
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 text-primary">•</span>
              <span>
                <strong className="text-foreground">Actions:</strong> Custom API
                integrations for external functionality
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Assistants API Section */}
      <section className="mb-16">
        <h2
          className="mb-6 font-semibold text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          OpenAI Assistants API for Developers
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>
            The Assistants API provides programmatic access to build AI agents
            with persistent conversations, file handling, and tool use. It
            supports more complex skill implementations compared to consumer
            GPTs.
          </p>
          <p>
            Key advantages for developers include thread management for
            multi-turn conversations, file search across uploaded documents, and
            function calling for integration with external systems.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border/50 bg-muted/30 p-6">
          <h3 className="mb-3 font-medium">Agent Skills in Assistants API</h3>
          <pre className="overflow-x-auto text-muted-foreground text-sm">
            {`// Example: Creating an assistant with skills
const assistant = await openai.beta.assistants.create({
  name: "Code Review Expert",
  instructions: \`You are an expert code reviewer.
    - Focus on security vulnerabilities
    - Check for performance issues
    - Suggest best practices\`,
  tools: [{ type: "code_interpreter" }],
  model: "gpt-4-turbo"
});`}
          </pre>
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
          Browse Agent Skills
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
          Discover skills that can be adapted for OpenAI agents. Find
          instructions, prompts, and configurations for your AI assistants.
        </p>
        <Link
          className="inline-block rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          href="/"
        >
          Explore the Library
        </Link>
      </section>
    </main>
  );
}
