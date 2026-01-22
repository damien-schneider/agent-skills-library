"use client";

import { Check, Copy, Download } from "lucide-react";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/shared/components/ui/button";
import { ButtonGroup } from "@/shared/components/ui/button-group";

interface MarkdownContentCardProps {
  skill: { markdown: string; color: string; name: string; sourceUrl?: string };
  copied: boolean;
  onCopy: () => void;
  onInstallClick: () => void;
}

export function MarkdownContentCard({
  skill,
  copied,
  onCopy,
  onInstallClick,
}: MarkdownContentCardProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/5"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.35 }}
    >
      <div className="flex items-center justify-between border-border border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-border" />
            <div className="h-3 w-3 rounded-full bg-border" />
            <div className="h-3 w-3 rounded-full bg-border" />
          </div>
          <span className="font-medium text-muted-foreground/60 text-sm">
            SKILL.md
          </span>
        </div>
        <ButtonGroup>
          <Button
            data-slot="button"
            onClick={onInstallClick}
            size="sm"
            variant="outline"
          >
            <Download className="h-4 w-4" />
            Install to Computer
          </Button>
          <Button
            data-slot="button"
            onClick={onCopy}
            size="icon-sm"
            title={copied ? "Copied!" : "Copy Markdown"}
            variant="outline"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </ButtonGroup>
      </div>

      <div
        className="prose prose-neutral dark:prose-invert max-w-none p-8"
        style={{
          background: `linear-gradient(135deg, ${skill.color}10 0%, transparent 50%)`,
        }}
      >
        <ReactMarkdown
          components={{
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline ? (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-sm">
                  {children}
                </code>
              ) : (
                <pre className="my-4 overflow-x-auto rounded-xl border border-border bg-muted p-5 text-foreground">
                  <code className="font-mono text-sm">{children}</code>
                </pre>
              );
            },
            h1: ({ children }) => (
              <h2 className="mt-8 mb-4 font-bold text-2xl text-foreground first:mt-0">
                {children}
              </h2>
            ),
            h2: ({ children }) => (
              <h3 className="mt-6 mb-3 font-semibold text-foreground text-xl">
                {children}
              </h3>
            ),
            h3: ({ children }) => (
              <h4 className="mt-4 mb-2 font-medium text-foreground text-lg">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="mb-4 text-muted-foreground/90 leading-relaxed">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="mb-4 ml-5 list-outside list-disc space-y-2 text-muted-foreground/90">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-4 ml-5 list-outside list-decimal space-y-2 text-muted-foreground/90">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-muted-foreground/90 leading-relaxed">
                {children}
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">
                {children}
              </strong>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-border border-l-4 pl-4 text-muted-foreground/70 italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {skill.markdown}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
}
