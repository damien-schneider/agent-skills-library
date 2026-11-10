import { describe, expect, it } from "vitest";

import {
  readFrontmatterFields,
  writeFrontmatterField,
} from "./frontmatter-fields";

describe("readFrontmatterFields", () => {
  it("reads plain, quoted and folded values as the text an agent sees", () => {
    expect(
      readFrontmatterFields(
        'name: "pdf"\ndescription: >\n  Fill PDF forms\n  and more.\nlicense: MIT'
      )
    ).toEqual({
      name: "pdf",
      description: "Fill PDF forms and more.",
      otherKeys: ["license"],
      problem: null,
    });
  });

  it("ignores a description nested under another key", () => {
    expect(
      readFrontmatterFields("name: pdf\nmetadata:\n  description: inner")
        .description
    ).toBe("");
  });

  it("reports why invalid YAML cannot be edited field by field", () => {
    expect(readFrontmatterFields("description: Driving: a browser")).toEqual({
      name: "",
      description: "",
      otherKeys: [],
      problem: "Nested mappings are not allowed in compact mappings",
    });
  });

  it("treats a document without frontmatter as empty, editable fields", () => {
    expect(readFrontmatterFields(null)).toEqual({
      name: "",
      description: "",
      otherKeys: [],
      problem: null,
    });
  });

  it("lists the other top-level keys in file order, leaving nested ones out", () => {
    expect(
      readFrontmatterFields(
        "license: MIT\nname: pdf\nmetadata:\n  author: me\ndescription: x\nallowed-tools: Read"
      ).otherKeys
    ).toEqual(["license", "metadata", "allowed-tools"]);
  });
});

describe("writeFrontmatterField", () => {
  const yaml =
    "name: pdf\ndescription: Fill PDF forms. # keep me\nlicense: MIT";

  it("changes only the edited field, keeping comments and other keys", () => {
    expect(writeFrontmatterField(yaml, "name", "pdf-forms")).toBe(
      "name: pdf-forms\ndescription: Fill PDF forms. # keep me\nlicense: MIT"
    );
  });

  it("quotes a value that would otherwise break the YAML", () => {
    const next = writeFrontmatterField(
      yaml,
      "description",
      "Use when: the user asks about PDFs"
    );
    expect(next).toBe(
      'name: pdf\ndescription: "Use when: the user asks about PDFs" # keep me\nlicense: MIT'
    );
    expect(readFrontmatterFields(next).description).toBe(
      "Use when: the user asks about PDFs"
    );
  });

  it("replaces a folded block without swallowing the key after it", () => {
    expect(
      writeFrontmatterField(
        "name: pdf\ndescription: >\n  Fill PDF forms\n  and more.\nallowed-tools: Read",
        "description",
        "Short one."
      )
    ).toBe("name: pdf\ndescription: Short one.\nallowed-tools: Read");
  });

  it("fills in a key that has no value yet", () => {
    expect(
      writeFrontmatterField(
        "name: pdf\ndescription:\nlicense: MIT",
        "description",
        "Now set"
      )
    ).toBe("name: pdf\ndescription: Now set\nlicense: MIT");
  });

  it("adds a missing name first and a missing description last", () => {
    expect(writeFrontmatterField("description: x", "name", "pdf")).toBe(
      "name: pdf\ndescription: x"
    );
    expect(writeFrontmatterField("name: pdf\n", "description", "Hello")).toBe(
      "name: pdf\ndescription: Hello"
    );
    expect(writeFrontmatterField(null, "name", "pdf")).toBe("name: pdf");
  });

  it("keeps a multi-line description readable and never wraps a long one", () => {
    expect(
      writeFrontmatterField(yaml, "description", "Line one\nLine two")
    ).toBe(
      "name: pdf\n# keep me\ndescription: |-\n  Line one\n  Line two\nlicense: MIT"
    );
    const long = "word ".repeat(40).trim();
    expect(writeFrontmatterField("description: a", "description", long)).toBe(
      `description: ${long}`
    );
  });

  it("writes the file's own line endings", () => {
    expect(
      writeFrontmatterField(
        "name: pdf\r\ndescription: a\r\nlicense: MIT",
        "description",
        "Line one\nLine two",
        "\r\n"
      )
    ).toBe(
      "name: pdf\r\ndescription: |-\r\n  Line one\r\n  Line two\r\nlicense: MIT"
    );
  });

  it("refuses to touch YAML it cannot parse", () => {
    expect(
      writeFrontmatterField("description: Driving: a browser", "name", "x")
    ).toBeNull();
  });
});
