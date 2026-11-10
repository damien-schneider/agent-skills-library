import { cn } from "@ctrl-ui/react/lib/cn";
import { CodeDiff } from "@ctrl-ui/react/ui/code-diff";
import { ScrollArea } from "@ctrl-ui/react/ui/scroll-area";
import { Text } from "@ctrl-ui/react/ui/typography";

export interface DiffViewProps {
  before: string;
  after: string;
  /** Layout only: where the diff sits and how tall it may grow before it scrolls. */
  className?: string;
}

export function DiffView({ before, after, className }: DiffViewProps) {
  if (before === after) {
    return (
      <Text as="p" className={className} tone="muted">
        No changes.
      </Text>
    );
  }

  // The caller caps the height through `className`, which only this outer
  // scroller can honour: the diff's own scroller takes a fixed CSS length.
  return (
    <ScrollArea
      className={cn("flex flex-col", className)}
      lockAxis="x"
      viewportClassName="min-h-0 flex-1"
    >
      <CodeDiff
        maxHeight="none"
        name="Changes"
        newText={after}
        oldText={before}
        overflow="wrap"
      />
    </ScrollArea>
  );
}
