import { Bot, FileText, type LucideIcon, ScrollText, Zap } from "lucide-react";

import type { FileKind } from "@/lib/ipc-types";

const KIND_ICONS: Record<FileKind, LucideIcon> = {
  skill: Zap,
  "claude-agent": Bot,
  "cursor-rule": ScrollText,
  "agents-md": FileText,
  "claude-md": FileText,
  "gemini-md": FileText,
};

/** Decorative: the row or header it sits in always names the kind in text. */
export function FileKindIcon({
  kind,
  className,
}: {
  kind: FileKind;
  className?: string;
}) {
  const Icon = KIND_ICONS[kind];
  return <Icon aria-hidden="true" className={className} />;
}
