import type { DiffResult } from "@/lib/ipc-types";

const CONTEXT_LINES = 3;

const MARKERS = { equal: " ", added: "+", removed: "-" } as const;

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  body: string[];
}

/** Unified diff points an empty side at the line before it, not the line after. */
function range(start: number, count: number): string {
  return `${count === 0 ? start - 1 : start},${count}`;
}

/** Marks every changed line and the few unchanged ones around it. */
function shownLines(diff: DiffResult): boolean[] {
  const shown = new Array<boolean>(diff.lines.length).fill(false);
  for (const [index, line] of diff.lines.entries()) {
    if (line.op !== "equal") {
      shown.fill(
        true,
        Math.max(0, index - CONTEXT_LINES),
        index + CONTEXT_LINES + 1
      );
    }
  }
  return shown;
}

function hunksOf(diff: DiffResult): Hunk[] {
  const shown = shownLines(diff);
  const hunks: Hunk[] = [];
  let open: Hunk | null = null;
  let oldLine = 1;
  let newLine = 1;

  for (const [index, line] of diff.lines.entries()) {
    const onOldSide = line.op !== "added";
    const onNewSide = line.op !== "removed";

    if (shown[index]) {
      if (open === null) {
        open = {
          oldStart: oldLine,
          oldCount: 0,
          newStart: newLine,
          newCount: 0,
          body: [],
        };
        hunks.push(open);
      }
      open.body.push(`${MARKERS[line.op]}${line.text}`);
      open.oldCount += onOldSide ? 1 : 0;
      open.newCount += onNewSide ? 1 : 0;
    } else {
      open = null;
    }

    oldLine += onOldSide ? 1 : 0;
    newLine += onNewSide ? 1 : 0;
  }

  return hunks;
}

/**
 * The backend sends both files aligned line by line, unchanged lines included.
 * Its alignment is kept as is (re-diffing the two texts would lose a change that
 * is only a trailing newline); only the long unchanged stretches are folded away.
 */
export function unifiedPatch(diff: DiffResult): string {
  return hunksOf(diff)
    .map((hunk) =>
      [
        `@@ -${range(hunk.oldStart, hunk.oldCount)} +${range(hunk.newStart, hunk.newCount)} @@`,
        ...hunk.body,
      ].join("\n")
    )
    .join("\n");
}
