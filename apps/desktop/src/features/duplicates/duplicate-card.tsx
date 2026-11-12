import { Badge } from "@ctrl-ui/react/ui/badge";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrl-ui/react/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
} from "@ctrl-ui/react/ui/item";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { ArrowUpRight, Check, Link2 } from "lucide-react";
import { useId } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { FileKindIcon } from "@/features/library/file-kind";
import { fileTitle } from "@/features/library/library-model";
import type { DuplicateGroup, FileRow } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";

/** Copies listed before the rest fold away: one skill can live in dozens of folders. */
const VISIBLE_COPIES = 4;

const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-padding-block": "calc(var(--spacing) * 1)",
} as const;

function kindSummary(files: FileRow[]): string {
  const labels = new Set(files.map((file) => targetLabel(file.kind)));
  return `${[...labels].join(", ")} · ${files.length} copies`;
}

export function DuplicateCard({
  group,
  home,
  onOpenFile,
  onKeepInSync,
  expanded,
  onToggleExpanded,
  busy = false,
  creating = false,
  failure = null,
}: {
  group: DuplicateGroup;
  home: string | null;
  onOpenFile: (file: FileRow) => void;
  /** Absent once the copies are tracked by a sync group. */
  onKeepInSync?: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  busy?: boolean;
  creating?: boolean;
  failure?: string | null;
}) {
  const titleId = useId();
  const first = group.files.at(0);
  if (!first) {
    return null;
  }

  const hiddenCount = Math.max(0, group.files.length - VISIBLE_COPIES);
  const shown = expanded ? group.files : group.files.slice(0, VISIBLE_COPIES);

  return (
    <Card aria-labelledby={titleId} role="group" size="sm">
      <CardHeader className="flex items-center gap-3">
        <FileKindIcon
          className="size-4 shrink-0 text-muted-foreground"
          kind={first.kind}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* biome-ignore lint/a11y/useHeadingContent: the title's children become the heading's content */}
          <CardTitle className="truncate" id={titleId} render={<h2 />}>
            {fileTitle(first)}
          </CardTitle>
          <CardDescription>{kindSummary(group.files)}</CardDescription>
        </div>
        {onKeepInSync ? (
          <Button
            aria-describedby={titleId}
            disabled={busy}
            onClick={onKeepInSync}
            size="sm"
            variant="surface"
          >
            {creating ? <Spinner /> : null}
            Keep in sync
          </Button>
        ) : (
          <Badge color="green">
            <Check aria-hidden="true" />
            Kept in sync
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ItemGroup aria-labelledby={titleId}>
          {shown.map((file) => (
            <CopyRow
              file={file}
              home={home}
              key={file.id}
              onOpenFile={onOpenFile}
            />
          ))}
        </ItemGroup>
        {hiddenCount > 0 ? (
          <Button
            aria-expanded={expanded}
            className="self-start"
            onClick={onToggleExpanded}
            size="sm"
            variant="ghost"
          >
            {expanded ? "Show fewer" : `Show ${hiddenCount} more`}
          </Button>
        ) : null}
        {failure ? (
          <Text as="p" role="alert" tone="destructive">
            {failure}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CopyRow({
  file,
  home,
  onOpenFile,
}: {
  file: FileRow;
  home: string | null;
  onOpenFile: (file: FileRow) => void;
}) {
  const pathId = useId();
  return (
    <Item role="listitem" style={ROW_STYLE}>
      <ItemContent>
        <Text
          as="div"
          className="truncate"
          id={pathId}
          mono
          size="label"
          title={file.path}
        >
          {displayPath(file.path, home)}
        </Text>
        {file.aliases.map((alias) => (
          <Text
            as="div"
            className="flex min-w-0 items-center gap-1"
            key={alias}
            mono
            size="caption"
            title={alias}
            tone="muted"
          >
            <Link2 aria-hidden="true" className="size-3 shrink-0" />
            <span className="sr-only">Symlink: </span>
            <span className="truncate">{displayPath(alias, home)}</span>
          </Text>
        ))}
      </ItemContent>
      <ItemActions>
        <IconButton
          aria-describedby={pathId}
          label="Open in Library"
          onClick={() => onOpenFile(file)}
        >
          <ArrowUpRight />
        </IconButton>
      </ItemActions>
    </Item>
  );
}
