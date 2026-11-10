import { cn } from "@ctrl-ui/react/lib/cn";
import { Button } from "@ctrl-ui/react/ui/button";
import { Item, ItemActions, ItemContent } from "@ctrl-ui/react/ui/item";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Check, Copy, Folder, Trash2 } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";
import { PromptAttachmentStrip } from "./prompt-attachment-strip";
import { claudeCodePrompt } from "./prompt-attachments";
import { formatDateTime, formatRelativeTime } from "./relative-time";
import { useCopyFeedback } from "./use-copy-feedback";

/** Whether the collapsed, line-clamped prompt hides any of its text. */
function useClampOverflow(content: string, expanded: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  // Measured, not guessed from the length: whether four lines hold a prompt
  // depends on the column width, and "Show more" must always reveal something.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a row handed new text must be measured again
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) {
      return;
    }
    const measure = () =>
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [content, expanded]);

  return [ref, overflows] as const;
}

/** Rows line up with the page's own edges, and the rule between two of them
 * stays straight, instead of each row sitting in as a rounded tile. */
const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-radius": "0px",
} as const;

export function PromptHistoryItem({
  entry,
  home,
  now,
  onRequestDelete,
}: {
  entry: PromptHistoryEntry;
  home: string | null;
  now: number;
  onRequestDelete: (entry: PromptHistoryEntry) => void;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [copied, markCopied] = useCopyFeedback();
  const [contentRef, overflows] = useClampOverflow(entry.content, expanded);
  const collapsible = overflows || expanded;

  const copy = async () => {
    try {
      await writeText(claudeCodePrompt(entry));
      markCopied();
    } catch {
      toast.error("Could not copy the prompt");
    }
  };

  return (
    <Item className="items-start" render={<li />} style={ROW_STYLE}>
      <ItemContent className="gap-2">
        <Text
          as="p"
          className={cn(
            "whitespace-pre-wrap break-words",
            !expanded && "line-clamp-4"
          )}
          id={contentId}
          ref={contentRef}
        >
          {entry.content}
        </Text>
        {collapsible ? (
          <Button
            aria-controls={contentId}
            aria-expanded={expanded}
            className="self-start"
            onClick={() => setExpanded((current) => !current)}
            size="xs"
            variant="link"
          >
            {expanded ? "Show less" : "Show more"}
          </Button>
        ) : null}
        {entry.attachments.length > 0 ? (
          <PromptAttachmentStrip attachments={entry.attachments} />
        ) : null}
        <div className="flex min-w-0 items-center gap-3">
          <Text
            as="span"
            className="shrink-0"
            numeric
            size="caption"
            tone="muted"
          >
            <time
              dateTime={new Date(entry.createdAt).toISOString()}
              title={formatDateTime(entry.createdAt)}
            >
              {formatRelativeTime(entry.createdAt, now)}
            </time>
          </Text>
          {entry.destinationPath ? (
            <DestinationPath home={home} path={entry.destinationPath} />
          ) : null}
        </div>
      </ItemContent>
      <ItemActions showOnHover>
        <IconButton
          aria-describedby={contentId}
          label={copied ? "Copied" : "Copy prompt"}
          onClick={copy}
        >
          {copied ? <Check /> : <Copy />}
        </IconButton>
        <IconButton
          aria-describedby={contentId}
          label="Delete prompt"
          onClick={() => onRequestDelete(entry)}
        >
          <Trash2 />
        </IconButton>
      </ItemActions>
    </Item>
  );
}

/** The folder name never truncates, only the tree above it does. */
function DestinationPath({
  home,
  path,
}: {
  home: string | null;
  path: string;
}) {
  const shortened = displayPath(path, home);
  const nameStart = shortened.lastIndexOf("/") + 1;
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={path}>
      <Folder
        aria-hidden="true"
        className="size-3 shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0">
        <Text as="span" className="truncate" mono size="caption" tone="muted">
          {shortened.slice(0, nameStart)}
        </Text>
        <Text as="span" className="shrink-0" mono size="caption" tone="muted">
          {shortened.slice(nameStart)}
        </Text>
      </span>
    </span>
  );
}
