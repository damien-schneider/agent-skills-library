import { CodeDiff } from "@ctrl-ui/react/ui/code-diff";
import { Text } from "@ctrl-ui/react/ui/typography";

import type { DiffResult } from "@/lib/ipc-types";

import { unifiedPatch } from "./unified-patch";

/** Renders a diff computed by Rust; `DiffView` renders the ones computed here. */
export function DiffLines({
  diff,
  className,
}: {
  diff: DiffResult;
  className?: string;
}) {
  if (diff.identical) {
    return (
      <Text as="p" className={className} tone="muted">
        No changes.
      </Text>
    );
  }

  // The plan scrolls as a whole; a scroller per diff would trap the wheel.
  return (
    <CodeDiff
      className={className}
      maxHeight="none"
      name="Changes"
      overflow="wrap"
      patch={unifiedPatch(diff)}
    />
  );
}
