import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "./markdown-editor";

describe("MarkdownEditor", () => {
  it("parses markdown when the document changes", async () => {
    const { container, rerender } = render(
      <MarkdownEditor onChange={vi.fn()} value="# First document" />
    );

    rerender(
      <MarkdownEditor
        onChange={vi.fn()}
        value={"# Second document\n\n- First item\n- Second item"}
      />
    );

    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe(
        "Second document"
      );
      expect(container.querySelectorAll("li")).toHaveLength(2);
    });
  });

  it("does not report external content as a user edit", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MarkdownEditor onChange={onChange} value="# First document" />
    );

    rerender(<MarkdownEditor onChange={onChange} value="# Second document" />);

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it("does not create undo history while normalizing markdown", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <MarkdownEditor
        onChange={onChange}
        value={"* First item\n* Second item\n"}
      />
    );

    await waitFor(() => {
      expect(
        container.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')
          ?.disabled
      ).toBe(true);
    });
    const editable = container.querySelector('[aria-label="Markdown editor"]');
    if (!editable) {
      throw new Error("Markdown editor did not render");
    }
    expect(fireEvent.keyDown(editable, { key: "z", metaKey: true })).toBe(
      false
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders preview content without editing controls", async () => {
    const { container } = render(
      <MarkdownEditor
        editable={false}
        onChange={vi.fn()}
        value={"## Preview\n\nRendered body"}
      />
    );

    await waitFor(() => {
      expect(container.querySelector("h2")?.textContent).toBe("Preview");
    });
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(
      container
        .querySelector('[aria-label="Markdown preview"]')
        ?.getAttribute("contenteditable")
    ).toBe("false");
  });
});
