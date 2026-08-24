import { render, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "@/shared/components/ui/markdown-editor";

import { createMentionStore, SkillMention } from "./skill-mention";

const DOCUMENT = [
  "- `damien-pr` — branch names",
  "- `damien-voice` — anything written in my name",
  "- `humanizer` — de-slop pass",
].join("\n");

function decorated(container: HTMLElement) {
  return [...container.querySelectorAll("[data-skill]")].map(
    (node) => node.textContent
  );
}

describe("skill mentions in the editor", () => {
  it("decorates every linked name once the index answers", async () => {
    const store = createMentionStore();
    const { container } = render(
      <MarkdownEditor
        extensions={[SkillMention.configure({ store })]}
        onChange={vi.fn()}
        value={DOCUMENT}
      />
    );

    await waitFor(() =>
      expect(container.querySelectorAll("li")).toHaveLength(3)
    );

    act(() => store.set(["damien-pr", "damien-voice", "humanizer"]));

    await waitFor(() =>
      expect(decorated(container)).toEqual([
        "damien-pr",
        "damien-voice",
        "humanizer",
      ])
    );
  });
});
