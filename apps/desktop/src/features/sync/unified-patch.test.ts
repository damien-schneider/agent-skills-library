import { applyPatch } from "diff";
import { describe, expect, it } from "vitest";

import type { DiffLine, DiffResult } from "@/lib/ipc-types";

import { unifiedPatch } from "./unified-patch";

function opOf(row: string): DiffLine["op"] {
  if (row.startsWith("+")) {
    return "added";
  }
  return row.startsWith("-") ? "removed" : "equal";
}

/** Builds what the backend sends from lines written the way a patch shows them. */
function aligned(...rows: string[]): DiffResult {
  let left = 0;
  let right = 0;
  const lines: DiffLine[] = rows.map((row) => {
    const op = opOf(row);
    const onLeft = op !== "added";
    const onRight = op !== "removed";
    left += onLeft ? 1 : 0;
    right += onRight ? 1 : 0;
    return {
      op,
      text: row.slice(1),
      leftNumber: onLeft ? left : null,
      rightNumber: onRight ? right : null,
    };
  });
  const added = lines.filter((line) => line.op === "added").length;
  const removed = lines.filter((line) => line.op === "removed").length;
  return { identical: added + removed === 0, added, removed, lines };
}

function side(diff: DiffResult, skipped: DiffLine["op"]): string {
  return diff.lines
    .filter((line) => line.op !== skipped)
    .map((line) => `${line.text}\n`)
    .join("");
}

const unchanged = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => ` line ${from + index}`);

describe("unifiedPatch", () => {
  it("keeps only a few unchanged lines around an edit", () => {
    const diff = aligned(
      ...unchanged(1, 9),
      "-old",
      "+new",
      ...unchanged(11, 20)
    );

    expect(unifiedPatch(diff).split("\n")).toEqual([
      "@@ -7,7 +7,7 @@",
      " line 7",
      " line 8",
      " line 9",
      "-old",
      "+new",
      " line 11",
      " line 12",
      " line 13",
    ]);
  });

  it("turns the member's content into the source's when applied", () => {
    const diff = aligned(
      "-# Old title",
      "+# New title",
      ...unchanged(2, 20),
      "+appended near the end",
      ...unchanged(21, 22),
      "-dropped last line"
    );

    expect(applyPatch(side(diff, "added"), unifiedPatch(diff))).toBe(
      side(diff, "removed")
    );
  });

  it("describes a file filled from empty the way patch tools expect", () => {
    const diff = aligned("+first", "+second");

    expect(unifiedPatch(diff).split("\n").at(0)).toBe("@@ -0,0 +1,2 @@");
    expect(applyPatch("", unifiedPatch(diff))).toBe("first\nsecond\n");
  });
});
