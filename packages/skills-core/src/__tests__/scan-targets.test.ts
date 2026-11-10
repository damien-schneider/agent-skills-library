import { describe, expect, it } from "vitest";

import {
  classifyPath,
  isSkippedDir,
  isVendorPluginDir,
  SCAN_TARGETS,
  SKIP_DIRS,
  targetLabel,
  VENDOR_PLUGIN_PARENTS,
} from "../scan-targets";

describe("classifyPath", () => {
  it.each([
    ["/repo/AGENTS.md", "agents-md"],
    ["/repo/packages/api/AGENTS.md", "agents-md"],
    ["/repo/CLAUDE.md", "claude-md"],
    ["/repo/CLAUDE.local.md", "claude-md"],
    ["/repo/GEMINI.md", "gemini-md"],
    ["/repo/.cursor/rules/style.mdc", "cursor-rule"],
    ["/repo/.claude/skills/my-skill/SKILL.md", "skill"],
    ["/Users/me/.claude/skills/deep/nested/SKILL.md", "skill"],
    ["/repo/.claude/agents/reviewer.md", "claude-agent"],
    ["C:\\repo\\.claude\\agents\\reviewer.md", "claude-agent"],
  ])("classifies %s as %s", (path, kind) => {
    expect(classifyPath(path)).toBe(kind);
  });

  it.each([
    "/repo/.agents/skills/my-skill/SKILL.md",
    "/Users/me/.codex/skills/my-skill/SKILL.md",
    "/repo/skills/my-skill/SKILL.md",
    "/repo/my-skill/SKILL.md",
    "/repo/SKILL.md",
    "/repo/.claude/agents/SKILL.md",
  ])("classifies %s as a skill whatever its ancestors", (path) => {
    expect(classifyPath(path)).toBe("skill");
  });

  it.each([
    "/repo/README.md",
    "/repo/agents.md",
    "/repo/skills/my-skill/skill.md",
    "/repo/skills/my-skill/SKILL.mdx",
    "/repo/.cursor/rules/style.md",
    "/repo/rules/style.mdc",
    "/repo/.claude/settings.json",
    "/repo/.claude/agents/config.json",
    "",
  ])("does not classify %s", (path) => {
    expect(classifyPath(path)).toBeNull();
  });

  it("requires the ancestor segments to be consecutive", () => {
    expect(classifyPath("/repo/.claude/other/agents/reviewer.md")).toBeNull();
    expect(classifyPath("/repo/.cursor/other/rules/style.mdc")).toBeNull();
  });
});

describe("scan target table", () => {
  it("freezes the kinds and their matching rules", () => {
    expect(SCAN_TARGETS).toEqual([
      { kind: "skill", label: "Skill", fileNames: ["SKILL.md"] },
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
    expect(SKIP_DIRS).not.toContain("plugins");
  });
});

describe("isVendorPluginDir", () => {
  it("freezes the agent homes whose plugins are vendor copies", () => {
    expect(VENDOR_PLUGIN_PARENTS).toEqual([
      ".claude",
      ".codex",
      ".cursor",
      ".gemini",
      ".agents",
    ]);
  });

  it.each(
    VENDOR_PLUGIN_PARENTS
  )("skips the plugins directory of %s", (home) => {
    expect(isVendorPluginDir(`/Users/me/${home}/plugins`)).toBe(true);
  });

  it.each([
    "/repo/plugins",
    "/repo/src/plugins",
    "/Users/me/.claude/skills",
    "/Users/me/.claude/plugins/cache",
    "plugins",
    "",
  ])("keeps %s", (path) => {
    expect(isVendorPluginDir(path)).toBe(false);
  });

  it("reads Windows separators", () => {
    expect(isVendorPluginDir("C:\\Users\\me\\.codex\\plugins")).toBe(true);
  });
});
