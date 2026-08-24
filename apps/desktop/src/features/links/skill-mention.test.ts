import { describe, expect, it } from "vitest";

import { createMentionStore, mentionRanges } from "./skill-mention";

const names = ["code-quality", "damien-pr"];

function matched(text: string) {
  return mentionRanges(text, names).map((range) => ({
    name: range.name,
    text: text.slice(range.from, range.from + range.name.length),
  }));
}

describe("mentionRanges", () => {
  it("matches a name whatever the surrounding markdown syntax", () => {
    expect(matched("see `code-quality` and [damien-pr](x)")).toEqual([
      { name: "code-quality", text: "code-quality" },
      { name: "damien-pr", text: "damien-pr" },
    ]);
  });

  it("keeps every occurrence so each one is hoverable", () => {
    expect(matched("code-quality then code-quality")).toHaveLength(2);
  });

  it("ignores a name glued to a longer word", () => {
    expect(matched("code-quality-extra and xcode-quality")).toEqual([]);
  });

  it("matches whatever the case, on the source casing", () => {
    expect(matched("Code-Quality")).toEqual([
      { name: "code-quality", text: "Code-Quality" },
    ]);
  });
});

describe("createMentionStore", () => {
  it("only notifies when the resolved names actually change", () => {
    const store = createMentionStore();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.set(["code-quality"]);
    store.set(["code-quality"]);
    store.set(["code-quality", "damien-pr"]);

    expect(notifications).toBe(2);
  });
});
