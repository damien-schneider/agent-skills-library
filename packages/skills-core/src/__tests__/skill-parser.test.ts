import { describe, expect, it } from "vitest";

import { parseSkillMarkdown, validateParsedSkill } from "../skill-parser";

describe("parseSkillMarkdown", () => {
  describe("frontmatter at top (standard YAML)", () => {
    it("parses name and description from top frontmatter", () => {
      const content = `---
name: "Test Skill"
description: "A test skill description"
author: "Test Author"
version: "1.0.0"
tags: ["test", "example"]
---

# Test Skill

This is the content of the skill.
`;
      const result = parseSkillMarkdown(content);

      expect(result.name).toBe("Test Skill");
      expect(result.description).toBe("A test skill description");
      expect(result.metadata?.author).toBe("Test Author");
      expect(result.metadata?.version).toBe("1.0.0");
      expect(result.metadata?.tags).toEqual(["test", "example"]);
    });

    it("handles frontmatter without quotes", () => {
      const content = `---
name: My Skill
description: A simple description here
---

# My Skill

Content here.
`;
      const result = parseSkillMarkdown(content);

      expect(result.name).toBe("My Skill");
      expect(result.description).toBe("A simple description here");
    });
  });

  describe("frontmatter at bottom (vercel-labs style)", () => {
    it("parses name and description from bottom frontmatter", () => {
      const content = `# DOCX Skill

This skill handles DOCX files with various operations.

## Overview

More content here...

---
name: docx
description: "Comprehensive document creation and editing"
license: Proprietary
---
`;
      const result = parseSkillMarkdown(content);

      expect(result.name).toBe("docx");
      expect(result.description).toBe(
        "Comprehensive document creation and editing"
      );
      expect(result.markdown).not.toContain("---\nname: docx");
    });

    it("handles nested metadata in bottom frontmatter", () => {
      const content = `# Vercel Deploy

Deploy any project instantly.

---
name: vercel-deploy
description: Deploy applications to Vercel
metadata:
  author: vercel
  version: "1.0.0"
---
`;
      const result = parseSkillMarkdown(content);

      expect(result.name).toBe("vercel-deploy");
      expect(result.metadata?.author).toBe("vercel");
      expect(result.metadata?.version).toBe("1.0.0");
    });
  });

  describe("plain markdown without frontmatter", () => {
    it("extracts title from H1 heading", () => {
      const content = `# My Amazing Skill

This skill does amazing things for your workflow.

## Features

- Feature 1
- Feature 2
`;
      const result = parseSkillMarkdown(content);

      expect(result.name).toBe("My Amazing Skill");
      expect(result.description).toBe(
        "This skill does amazing things for your workflow."
      );
    });

    it("uses default name when no title found", () => {
      const content = `Some content without a proper heading.

Just paragraphs and more content.
`;
      const result = parseSkillMarkdown(content);

      expect(result.name).toBe("Untitled Skill");
    });

    it("extracts first paragraph as description", () => {
      const content = `# Skill Name

This is the first paragraph that describes the skill.

## More Content

Additional sections...
`;
      const result = parseSkillMarkdown(content);

      expect(result.description).toBe(
        "This is the first paragraph that describes the skill."
      );
    });
  });

  describe("edge cases", () => {
    it("truncates long descriptions", () => {
      const longDescription = "A".repeat(600);
      const content = `# Skill

${longDescription}
`;
      const result = parseSkillMarkdown(content);

      expect(result.description.length).toBeLessThanOrEqual(500);
      expect(result.description).toContain("...");
    });

    it("handles empty tags array", () => {
      const content = `---
name: Test
description: Test description
tags: []
---

# Test
`;
      const result = parseSkillMarkdown(content);

      expect(result.metadata?.tags).toEqual([]);
    });

    it("handles mixed frontmatter (top and bottom)", () => {
      const content = `---
author: Top Author
---

# Skill Title

Content here.

---
name: bottom-name
description: Bottom description
---
`;
      const result = parseSkillMarkdown(content);

      // Bottom frontmatter should take precedence for name/description
      expect(result.name).toBe("bottom-name");
      expect(result.description).toBe("Bottom description");
    });
  });
});

describe("validateParsedSkill", () => {
  it("validates a complete skill", () => {
    const skill = {
      name: "Valid Skill",
      description: "A valid description that is long enough",
      markdown: `# Valid Skill\n\n${"Content ".repeat(20)}`,
    };

    const result = validateParsedSkill(skill);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects short name", () => {
    const skill = {
      name: "AB",
      description: "A valid description",
      markdown: `# AB\n\n${"Content ".repeat(20)}`,
    };

    const result = validateParsedSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Skill name must be at least 3 characters");
  });

  it("rejects short description", () => {
    const skill = {
      name: "Valid Name",
      description: "Short",
      markdown: `# Valid Name\n\n${"Content ".repeat(20)}`,
    };

    const result = validateParsedSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Skill description must be at least 10 characters"
    );
  });

  it("rejects short markdown content", () => {
    const skill = {
      name: "Valid Name",
      description: "A valid description",
      markdown: "Too short",
    };

    const result = validateParsedSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Skill content must be at least 50 characters"
    );
  });

  it("collects multiple errors", () => {
    const skill = {
      name: "AB",
      description: "Short",
      markdown: "Tiny",
    };

    const result = validateParsedSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});
