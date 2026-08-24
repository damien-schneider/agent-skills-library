import { ArrowDownLeft, ArrowUpRight, type LucideIcon } from "lucide-react";

import type { FileLinks, FileRow } from "@/lib/ipc-types";

import { linkLabel } from "./link-label";
import { SkillPreviewTrigger } from "./skill-preview";

function LinkGroup({
  files,
  icon: Icon,
  title,
  onSelect,
}: {
  files: FileRow[];
  icon: LucideIcon;
  title: string;
  onSelect: (file: FileRow) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">{title}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {files.map((file) => (
          <SkillPreviewTrigger file={file} key={file.id} onOpen={onSelect}>
            <button
              className="max-w-56 truncate rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:bg-accent hover:text-foreground hover:decoration-foreground/40 motion-reduce:transition-none"
              onClick={() => onSelect(file)}
              type="button"
            >
              {linkLabel(file)}
            </button>
          </SkillPreviewTrigger>
        ))}
      </div>
    </div>
  );
}

export function LinksBar({
  links,
  onSelect,
}: {
  links: FileLinks;
  onSelect: (file: FileRow) => void;
}) {
  if (links.outgoing.length === 0 && links.incoming.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-border border-b px-4 py-1.5 text-muted-foreground text-xs">
      <LinkGroup
        files={links.outgoing}
        icon={ArrowUpRight}
        onSelect={onSelect}
        title="References"
      />
      <LinkGroup
        files={links.incoming}
        icon={ArrowDownLeft}
        onSelect={onSelect}
        title="Referenced by"
      />
    </div>
  );
}
