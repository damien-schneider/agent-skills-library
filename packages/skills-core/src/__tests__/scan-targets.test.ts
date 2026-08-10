import { describe, expect, it } from "vitest";

import {
  classifyPath,
  isSkippedDir,
  SCAN_TARGETS,
  SKIP_DIRS,
  targetLabel,
} from "../scan-targets";

describe("classifyPath", () => {
  it.each([
    ["/repo/AGENTS.md", "agents-md"],
    ["/repo/packages/api/AGENTS.md", "agents-md"],
    ["/repo/CLAUDE.md", "claude-md"],
    ["/repo/CLAUDE.local.md", "claude-md"],
    ["/repo/GEMINI.md", "gemini-md"],
    ["/repo/.cursor/rules/style.mdc", "cursor-rule"],
    ["/repo/.claude/skills/my-skill/SKILL.md", "claude-skill"],
    ["/Users/me/.claude/skills/deep/nested/SKILL.md", "claude-skill"],
    ["/repo/.claude/agents/reviewer.md", "claude-agent"],
    ["C:\\repo\\.claude\\agents\\reviewer.md", "claude-agent"],
  ])("classifies %s as %s", (path, kind) => {
    expect(classifyPath(path)).toBe(kind);
  });

  it.each([
    "/repo/README.md",
    "/repo/agents.md",
    "/repo/skills/my-skill/SKILL.md",
    "/repo/.cursor/rules/style.md",
    "/repo/rules/style.mdc",
    "/repo/.claude/settings.json",
    "/repo/.claude/agents/config.json",
    "",
  ])("does not classify %s", (path) => {
    expect(classifyPath(path)).toBeNull();
  });

  it("requires the ancestor segments to be consecutive", () => {
    expect(classifyPath("/repo/.claude/other/skills/x/SKILL.md")).toBeNull();
  });
});

describe("scan target table", () => {
  it("freezes the kinds and their matching rules", () => {
    expect(SCAN_TARGETS).toEqual([
      {
        kind: "claude-skill",
        label: "Claude skill",
        fileNames: ["SKILL.md"],
        ancestorDir: ".claude/skills",
      },
      {
        kind: "claude-agent",
        label: "Claude agent",
        extension: ".md",
        ancestorDir: ".claude/agents",
      },
      {
        kind: "cursor-rule",
        label: "Cursor rule",
        extension: ".mdc",
        ancestorDir: ".cursor/rules",
      },
      { kind: "agents-md", label: "AGENTS.md", fileNames: ["AGENTS.md"] },
      {
        kind: "claude-md",
        label: "CLAUDE.md",
        fileNames: ["CLAUDE.md", "CLAUDE.local.md"],
      },
      { kind: "gemini-md", label: "GEMINI.md", fileNames: ["GEMINI.md"] },
    ]);
  });

  it("exposes a label for every kind", () => {
    for (const target of SCAN_TARGETS) {
      expect(targetLabel(target.kind)).toBe(target.label);
    }
  });
});

describe("isSkippedDir", () => {
  it("skips build and vcs directories", () => {
    expect(isSkippedDir("node_modules")).toBe(true);
    expect(isSkippedDir(".git")).toBe(true);
    expect(isSkippedDir("src")).toBe(false);
  });

  it("never skips agent config directories", () => {
    expect(SKIP_DIRS).not.toContain(".claude");
    expect(SKIP_DIRS).not.toContain(".cursor");
  });
});
