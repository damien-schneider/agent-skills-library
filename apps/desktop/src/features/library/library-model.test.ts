import { describe, expect, it } from "vitest";

import type { FileRow, Root } from "@/lib/ipc-types";

import { buildLibraryModel, entryTitle } from "./library-model";

const HOME = "/Users/me";
const roots: Root[] = [
  { id: 1, path: `${HOME}/GitHub`, enabled: true, addedAt: 0 },
  { id: 2, path: `${HOME}/.claude`, enabled: true, addedAt: 0 },
];

function skill(
  id: number,
  path: string,
  overrides: Partial<FileRow> = {}
): FileRow {
  return {
    id,
    rootId: path.startsWith(`${HOME}/GitHub`) ? 1 : 2,
    path,
    relPath: path,
    kind: "skill",
    name: null,
    description: null,
    aliases: [],
    projectDir: null,
    size: 1,
    mtimeNs: 1,
    hash: `h${id}`,
    isSymlink: false,
    symlinkTarget: null,
    firstSeenAt: 0,
    lastSeenScanId: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe("buildLibraryModel", () => {
  it("lists a repository skill linked into an agent home in both sections", () => {
    const repo = `${HOME}/GitHub/skills`;
    const model = buildLibraryModel(
      [
        skill(1, `${repo}/writing/humanizer/SKILL.md`, {
          projectDir: repo,
          aliases: [`${HOME}/.claude/skills/humanizer/SKILL.md`],
        }),
      ],
      roots
    );

    const [personal] = model.personal;
    const [project] = model.projects;
    expect(personal?.label).toBe("Claude Code");
    expect(personal?.path).toBe(`${HOME}/.claude`);
    expect(project?.path).toBe(repo);

    const linked = personal?.collections[0]?.entries[0];
    const own = project?.collections[0]?.entries[0];
    expect(linked?.linked).toBe(true);
    expect(own?.linked).toBe(false);
    expect(linked?.id).not.toBe(own?.id);
    expect(linked && entryTitle(linked)).toBe("humanizer");
    expect(model.locationsByEntryId.get(linked?.id ?? "")?.scopeId).toBe(
      personal?.id
    );
  });

  it("keeps a repository's own .claude folder with the repository", () => {
    const repo = `${HOME}/GitHub/app`;
    const model = buildLibraryModel(
      [
        skill(1, `${repo}/.claude/skills/deploy/SKILL.md`, {
          projectDir: repo,
          aliases: [`${repo}/.agents/skills/deploy/SKILL.md`],
        }),
      ],
      roots
    );

    expect(model.personal).toEqual([]);
    expect(model.projects.map((scope) => scope.path)).toEqual([repo]);
    expect(model.projects[0]?.entryCount).toBe(1);
  });

  it("treats an agent home that is itself a git repository as personal", () => {
    const model = buildLibraryModel(
      [
        skill(1, `${HOME}/.claude/skills/notes/SKILL.md`, {
          projectDir: `${HOME}/.claude`,
        }),
      ],
      roots
    );

    expect(model.personal.map((scope) => scope.path)).toEqual([
      `${HOME}/.claude`,
    ]);
    expect(model.projects).toEqual([]);
  });

  it("names a worktree after its repository and branch folder", () => {
    const repo = `${HOME}/GitHub/mastra`;
    const worktree = `${repo}/.claude/worktrees/fix-login`;
    const model = buildLibraryModel(
      [
        skill(1, `${repo}/.claude/skills/a/SKILL.md`, { projectDir: repo }),
        skill(2, `${worktree}/.claude/skills/a/SKILL.md`, {
          projectDir: worktree,
        }),
      ],
      roots
    );

    expect(model.personal).toEqual([]);
    expect(model.projects.map((scope) => [scope.kind, scope.label])).toEqual([
      ["project", "mastra"],
      ["worktree", "mastra › fix-login"],
    ]);
  });
});
