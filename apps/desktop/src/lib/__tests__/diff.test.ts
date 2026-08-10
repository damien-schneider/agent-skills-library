import { describe, expect, it } from "vitest";

import { countChanges, diffLines, hasChanges } from "../diff";

function render(before: string, after: string): string[] {
  return diffLines(before, after).map((line) => {
    const marker = { equal: " ", added: "+", removed: "-" }[line.op];
    return `${marker}${line.text}`;
  });
}

describe("diffLines", () => {
  it("marks identical documents as unchanged", () => {
    const lines = diffLines("a\nb\n", "a\nb\n");

    expect(hasChanges(lines)).toBe(false);
    expect(lines.map((line) => line.op)).toEqual(["equal", "equal", "equal"]);
  });

  it("reports an inserted line", () => {
    expect(render("a\nc", "a\nb\nc")).toEqual([" a", "+b", " c"]);
  });

  it("reports a removed line", () => {
    expect(render("a\nb\nc", "a\nc")).toEqual([" a", "-b", " c"]);
  });

  it("reports a replaced line as removed then added", () => {
    expect(render("a\nb", "a\nB")).toEqual([" a", "-b", "+B"]);
  });

  it("numbers lines on each side", () => {
    const lines = diffLines("a\nb", "a\nB");

    expect(lines.map((line) => [line.leftNumber, line.rightNumber])).toEqual([
      [1, 1],
      [2, null],
      [null, 2],
    ]);
  });

  it("handles an empty document on either side", () => {
    expect(render("", "a")).toEqual(["+a"]);
    expect(render("a", "")).toEqual(["-a"]);
    expect(diffLines("", "")).toEqual([]);
  });

  it("counts additions and removals", () => {
    const counts = countChanges(diffLines("a\nb\nc", "a\nx\ny\nc"));

    expect(counts).toEqual({ added: 2, removed: 1 });
  });

  it("keeps trailing newline differences visible", () => {
    expect(render("a", "a\n")).toEqual([" a", "+"]);
  });
});
