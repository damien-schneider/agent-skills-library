"use client";

import { Check, Copy, Download } from "lucide-react";
import { motion } from "motion/react";
import { Streamdown } from "streamdown";

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
        <Streamdown
          components={{
            code: (props) => {
              const { children, className } = props;
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
            h1: (props) => (
              <h2 className="mt-8 mb-4 font-bold text-2xl text-foreground first:mt-0">
                {props.children}
              </h2>
            ),
            h2: (props) => (
              <h3 className="mt-6 mb-3 font-semibold text-foreground text-xl">
                {props.children}
              </h3>
            ),
            h3: (props) => (
              <h4 className="mt-4 mb-2 font-medium text-foreground text-lg">
                {props.children}
              </h4>
            ),
            p: (props) => (
              <p className="mb-4 text-muted-foreground/90 leading-relaxed">
                {props.children}
              </p>
            ),
            ul: (props) => (
              <ul className="mb-4 ml-5 list-outside list-disc space-y-2 text-muted-foreground/90">
                {props.children}
              </ul>
            ),
            ol: (props) => (
              <ol className="mb-4 ml-5 list-outside list-decimal space-y-2 text-muted-foreground/90">
                {props.children}
              </ol>
            ),
            li: (props) => (
              <li className="text-muted-foreground/90 leading-relaxed">
                {props.children}
              </li>
            ),
            strong: (props) => (
              <strong className="font-semibold text-foreground">
                {props.children}
              </strong>
            ),
            blockquote: (props) => (
              <blockquote className="my-4 border-border border-l-4 pl-4 text-muted-foreground/70 italic">
                {props.children}
              </blockquote>
            ),
            table: (props) => (
              <div className="my-4 overflow-x-auto">
                <table className="min-w-full border-collapse border border-border">
                  {props.children}
                </table>
              </div>
            ),
            thead: (props) => (
              <thead className="bg-muted">{props.children}</thead>
            ),
            tbody: (props) => <tbody>{props.children}</tbody>,
            tr: (props) => (
              <tr className="border-border border-b even:bg-muted/30">
                {props.children}
              </tr>
            ),
            th: (props) => (
              <th className="border-border border-r border-b bg-muted px-4 py-2 text-left font-semibold text-foreground last:border-r-0">
                {props.children}
              </th>
            ),
            td: (props) => (
              <td className="border-border border-r px-4 py-2 text-muted-foreground/90 last:border-r-0">
                {props.children}
              </td>
            ),
          }}
        >
          {skill.markdown}
        </Streamdown>
      </div>
    </motion.div>
  );
}
