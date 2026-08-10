export type DiffOp = "equal" | "added" | "removed";

export interface DiffLine {
  op: DiffOp;
  text: string;
  leftNumber: number | null;
  rightNumber: number | null;
}

function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split("\n");
}

function lcsTable(left: string[], right: string[]): number[][] {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0)
  );

  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const row = table[i] as number[];
      const next = table[i + 1] as number[];
      row[j] =
        left[i] === right[j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  return table;
}

/** Line-level LCS diff — enough for agent config files, which stay small. */
export function diffLines(before: string, after: string): DiffLine[] {
  const left = splitLines(before);
  const right = splitLines(after);
  const table = lcsTable(left, right);

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      lines.push({
        op: "equal",
        text: left[i] as string,
        leftNumber: i + 1,
        rightNumber: j + 1,
      });
      i++;
      j++;
      continue;
    }
    const keepLeft = (table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0);
    if (keepLeft) {
      lines.push({
        op: "removed",
        text: left[i] as string,
        leftNumber: i + 1,
        rightNumber: null,
      });
      i++;
    } else {
      lines.push({
        op: "added",
        text: right[j] as string,
        leftNumber: null,
        rightNumber: j + 1,
      });
      j++;
    }
  }

  while (i < left.length) {
    lines.push({
      op: "removed",
      text: left[i] as string,
      leftNumber: i + 1,
      rightNumber: null,
    });
    i++;
  }
  while (j < right.length) {
    lines.push({
      op: "added",
      text: right[j] as string,
      leftNumber: null,
      rightNumber: j + 1,
    });
    j++;
  }

  return lines;
}

export function hasChanges(lines: DiffLine[]): boolean {
  return lines.some((line) => line.op !== "equal");
}

export function countChanges(lines: DiffLine[]): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.op === "added") {
      added++;
    }
    if (line.op === "removed") {
      removed++;
    }
  }
  return { added, removed };
}
