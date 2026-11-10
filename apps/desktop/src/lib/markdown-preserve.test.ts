import {
  createMarkdownCodec,
  requiresMarkdownSource,
} from "@ctrl-ui/react/markdown-editor/extensions";
import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
  describeNode,
  type PreservedMarkdown,
  preserveMarkdown,
  SOURCE_BLOCK_LANGUAGE,
} from "./markdown-preserve";

const codec = createMarkdownCodec();
const requiresSource = (markdown: string) =>
  requiresMarkdownSource(markdown, codec);

function open(body: string): PreservedMarkdown {
  const preserved = preserveMarkdown(body, codec, requiresSource);
  if (!preserved) {
    throw new Error("Expected the document to open in the rich editor");
  }
  return preserved;
}

/** What the editor holds after loading: the nodes it parsed from the markdown it was given. */
function nodesOf(preserved: PreservedMarkdown): JSONContent[] {
  return codec.parse(preserved.editorMarkdown).content ?? [];
}

function save(preserved: PreservedMarkdown, nodes: JSONContent[]): string {
  return preserved.merge(nodes.map((node) => describeNode(node, codec)));
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

const TABLE = "| Tool   | Use |\n|:-------|----:|\n| `rg`   |   1 |\n";
const DOCUMENT = `# Title

Intro paragraph
wrapped by hand.

* star bullet
* another

${TABLE}
Setext heading
--------------

Last paragraph.
`;

describe("preserveMarkdown", () => {
  it("returns the file untouched when nothing was edited", () => {
    for (const body of [
      DOCUMENT,
      "\n\nstarts with blank lines\n\n\n\nand has extra ones\n\n\n",
      "no trailing newline",
      "",
      "CRLF line one\r\n\r\n* item\r\n* item\r\n",
    ]) {
      const preserved = open(body);
      expect(save(preserved, nodesOf(preserved))).toBe(body);
    }
  });

  it("rewrites only the block that was edited", () => {
    const preserved = open(DOCUMENT);
    const nodes = nodesOf(preserved);
    nodes[1] = paragraph("A new intro.");

    expect(save(preserved, nodes)).toBe(
      DOCUMENT.replace("Intro paragraph\nwrapped by hand.", "A new intro.")
    );
  });

  it("adds a new block with a blank line and keeps the file's ending", () => {
    const preserved = open("# Title\n\nBody.\n");
    const nodes = [...nodesOf(preserved), paragraph("Appended.")];

    expect(save(preserved, nodes)).toBe("# Title\n\nBody.\n\nAppended.\n");
  });

  it("removes a deleted block without disturbing its neighbours", () => {
    const preserved = open(DOCUMENT);
    const nodes = nodesOf(preserved).filter((node) => node.type !== "table");

    expect(save(preserved, nodes)).toBe(DOCUMENT.replace(`${TABLE}\n`, ""));
  });

  it("separates blocks that only a deleted block kept apart", () => {
    const preserved = open("First.\n```\ncode\n```\nSecond.\n");
    const nodes = nodesOf(preserved).filter(
      (node) => node.type !== "codeBlock"
    );

    expect(save(preserved, nodes)).toBe("First.\n\nSecond.\n");
  });

  it("moves a block with its own formatting", () => {
    const preserved = open(DOCUMENT);
    const nodes = nodesOf(preserved);
    const [table] = nodes.splice(3, 1);
    if (!table) {
      throw new Error("Expected a table at index 3");
    }
    nodes.push(table);

    const saved = save(preserved, nodes);
    expect(saved.endsWith(`Last paragraph.\n\n${TABLE}`)).toBe(true);
    expect(
      saved.startsWith("# Title\n\nIntro paragraph\nwrapped by hand.")
    ).toBe(true);
  });

  it("ignores empty paragraphs left behind while typing", () => {
    const preserved = open("# Title\n\nBody.\n");
    const [title, body] = nodesOf(preserved);
    if (!(title && body)) {
      throw new Error("Expected two blocks");
    }

    expect(
      save(preserved, [
        title,
        { type: "paragraph" },
        body,
        { type: "paragraph" },
      ])
    ).toBe("# Title\n\nBody.\n");
  });

  it("shows unsupported blocks as source and writes them back verbatim", () => {
    const html = "<details>\n<summary>More</summary>\n\nHidden\n</details>";
    const body = `Before.\n\n${html}\n\nAfter.\n`;
    const preserved = open(body);
    const nodes = nodesOf(preserved);

    expect(preserved.sourceBlockCount).toBeGreaterThan(0);
    expect(
      nodes.some((node) => node.attrs?.language === SOURCE_BLOCK_LANGUAGE)
    ).toBe(true);
    expect(save(preserved, nodes)).toBe(body);

    nodes[0] = paragraph("Changed.");
    expect(save(preserved, nodes)).toBe(body.replace("Before.", "Changed."));
  });

  it("writes an edited source block as the raw text typed into it", () => {
    const preserved = open("Before.\n\n<br>\n\nAfter.\n");
    const nodes = nodesOf(preserved).map((node) =>
      node.attrs?.language === SOURCE_BLOCK_LANGUAGE
        ? { ...node, content: [{ type: "text", text: "<hr>" }] }
        : node
    );

    expect(save(preserved, nodes)).toBe("Before.\n\n<hr>\n\nAfter.\n");
  });

  it("keeps link definitions even when the block above them is deleted", () => {
    const body =
      "See [the guide][guide].\n\n[guide]: https://example.com\n\nEnd.\n";
    const preserved = open(body);
    const nodes = nodesOf(preserved);

    expect(save(preserved, nodes)).toBe(body);
    expect(save(preserved, nodes.slice(1))).toBe(
      "[guide]: https://example.com\n\nEnd.\n"
    );
  });

  it("keeps CRLF line endings in the blocks it rewrites", () => {
    const preserved = open("One.\r\n\r\nTwo.\r\n");
    const nodes = nodesOf(preserved);
    nodes[1] = paragraph("Changed.");

    expect(save(preserved, nodes)).toBe("One.\r\n\r\nChanged.\r\n");
  });

  it("declines documents with mixed line endings", () => {
    expect(
      preserveMarkdown("One.\r\n\r\nTwo.\n", codec, requiresSource)
    ).toBeNull();
  });
});
