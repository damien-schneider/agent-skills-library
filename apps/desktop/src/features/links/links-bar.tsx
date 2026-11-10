import { Button } from "@ctrl-ui/react/ui/button";
import { Text } from "@ctrl-ui/react/ui/typography";

import type { FileLinks, FileRow } from "@/lib/ipc-types";

import { linkLabel } from "./link-label";
import { SkillPreviewTrigger } from "./skill-preview";

function LinkGroup({
  files,
  title,
  onSelect,
}: {
  files: FileRow[];
  title: string;
  onSelect: (file: FileRow) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Text className="me-1" size="caption" tone="muted">
        {title}
      </Text>
      {files.map((file) => (
        <SkillPreviewTrigger file={file} key={file.id} onOpen={onSelect}>
          <Button
            className="max-w-56"
            onClick={() => onSelect(file)}
            size="xs"
            variant="surface"
          >
            <span className="truncate">{linkLabel(file)}</span>
          </Button>
        </SkillPreviewTrigger>
      ))}
    </div>
  );
}

/** The files the open document names, and the files that name it. */
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
    <nav
      aria-label="Linked files"
      className="flex flex-wrap items-center gap-x-6 gap-y-2"
    >
      <LinkGroup files={links.outgoing} onSelect={onSelect} title="Mentions" />
      <LinkGroup
        files={links.incoming}
        onSelect={onSelect}
        title="Mentioned by"
      />
    </nav>
  );
}
