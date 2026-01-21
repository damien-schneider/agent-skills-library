"use client";

import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface MarkdownPreviewProps {
  frontmatter: string;
  markdown: string;
  onCopyToClipboard: () => void;
}

export function MarkdownPreview({
  frontmatter,
  markdown,
  onCopyToClipboard,
}: MarkdownPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-border border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <span className="ml-2 font-mono text-muted-foreground text-xs">
            SKILL.md
          </span>
        </div>
        <motion.button
          className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-medium text-xs transition-colors hover:bg-muted/80"
          onClick={handleCopy}
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </motion.button>
      </div>

      <div className="max-h-[500px] overflow-y-auto p-5">
        <pre className="whitespace-pre-wrap font-mono text-foreground text-xs leading-relaxed">
          <code className="text-emerald-500">{frontmatter}</code>
          {"\n\n"}
          <code className="text-muted-foreground">{markdown}</code>
        </pre>
      </div>
    </div>
  );
}
