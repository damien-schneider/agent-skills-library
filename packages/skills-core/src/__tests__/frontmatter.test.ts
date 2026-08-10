import { describe, expect, it } from "vitest";

import {
  hasFrontmatter,
  joinFrontmatter,
  splitFrontmatter,
} from "../frontmatter";

function roundTrip(content: string): string {
  return joinFrontmatter(splitFrontmatter(content));
}

describe("splitFrontmatter", () => {
  it("extracts the yaml block and leaves the body verbatim", () => {
    const content =
      "---\nname: demo\ndescription: hi\n---\n\n# Title\n\nBody.\n";
    const split = splitFrontmatter(content);

    expect(split.frontmatter).toBe("name: demo\ndescription: hi");
    expect(split.body).toBe("\n# Title\n\nBody.\n");
    expect(split.lineEnding).toBe("\n");
  });

  it("returns null frontmatter for a plain markdown document", () => {
    const content = "# Title\n\nNo frontmatter here.\n";
    const split = splitFrontmatter(content);

    expect(split.frontmatter).toBeNull();
    expect(split.body).toBe(content);
  });

  it("ignores a fence that is not on the first line", () => {
    const content = "# Title\n\n---\nname: demo\n---\n";

    expect(splitFrontmatter(content).frontmatter).toBeNull();
  });

  it("ignores an unterminated fence", () => {
    const content = "---\nname: demo\n\n# Title\n";

    expect(splitFrontmatter(content).frontmatter).toBeNull();
  });

  it("handles an empty frontmatter block", () => {
    const split = splitFrontmatter("---\n---\nbody\n");

    expect(split.frontmatter).toBe("");
    expect(split.body).toBe("body\n");
  });

  it("keeps crlf line endings", () => {
    const split = splitFrontmatter("---\r\nname: demo\r\n---\r\nbody\r\n");

    expect(split.frontmatter).toBe("name: demo");
    expect(split.lineEnding).toBe("\r\n");
    expect(split.body).toBe("body\r\n");
  });

  it("does not treat a thematic break inside the body as a closing fence", () => {
    const split = splitFrontmatter("---\nname: demo\n---\ntext\n---\nmore\n");

    expect(split.frontmatter).toBe("name: demo");
    expect(split.body).toBe("text\n---\nmore\n");
  });
});

describe("joinFrontmatter", () => {
  it.each([
    "---\nname: demo\n---\n\n# Title\n",
    "---\n---\nbody\n",
    "---\r\nname: demo\r\n---\r\nbody\r\n",
    "# Title\n\nPlain markdown.\n",
    "\uFEFF---\nname: demo\n---\nbody\n",
    "--- \nname: demo\n--- \nbody\n",
    "---\nname: demo\n---",
    "---\nnested:\n  key: value\n---\nbody\n",
  ])("round-trips %j byte for byte", (content) => {
    expect(roundTrip(content)).toBe(content);
  });

  it("rebuilds the document after editing the body", () => {
    const split = splitFrontmatter("---\nname: demo\n---\nold body\n");
    const rebuilt = joinFrontmatter({ ...split, body: "new body\n" });

    expect(rebuilt).toBe("---\nname: demo\n---\nnew body\n");
  });

  it("rebuilds the document after editing the frontmatter", () => {
    const split = splitFrontmatter("---\nname: demo\n---\nbody\n");
    const rebuilt = joinFrontmatter({ ...split, frontmatter: "name: other" });

    expect(rebuilt).toBe("---\nname: other\n---\nbody\n");
  });
});

describe("hasFrontmatter", () => {
  it("reports presence", () => {
    expect(hasFrontmatter("---\nname: demo\n---\n")).toBe(true);
    expect(hasFrontmatter("# Title\n")).toBe(false);
  });
});
