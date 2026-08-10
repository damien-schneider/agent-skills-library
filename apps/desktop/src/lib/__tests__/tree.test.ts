import { describe, expect, it } from "vitest";

import type { FileRow, Root } from "../ipc-types";
import { buildTree, fileIdOf, fileNodeId, TREE_ROOT_ID } from "../tree";

const root: Root = {
  id: 1,
  path: "/Users/me/GitHub",
  enabled: true,
  addedAt: 0,
};

function file(id: number, relPath: string, rootId = 1): FileRow {
  return {
    id,
    rootId,
    path: `/Users/me/GitHub/${relPath}`,
    relPath,
    kind: "claude-md",
    projectDir: null,
    size: 1,
    mtimeNs: 1,
    hash: `h${id}`,
    isSymlink: false,
    symlinkTarget: null,
    firstSeenAt: 0,
    lastSeenScanId: 1,
    deletedAt: null,
  };
}

describe("buildTree", () => {
  it("nests files under their relative path segments", () => {
    const index = buildTree([file(1, "app/api/CLAUDE.md")], [root]);

    const rootBranch = index[TREE_ROOT_ID]?.childIds[0] as string;
    expect(index[rootBranch]?.name).toBe("GitHub");
    const appId = index[rootBranch]?.childIds[0] as string;
    expect(index[appId]?.name).toBe("app");
    const apiId = index[appId]?.childIds[0] as string;
    expect(index[apiId]?.name).toBe("api");
    expect(index[apiId]?.childIds).toEqual([fileNodeId(1)]);
    expect(index[fileNodeId(1)]?.file?.id).toBe(1);
  });

  it("shares folder nodes between siblings", () => {
    const index = buildTree(
      [file(1, "app/CLAUDE.md"), file(2, "app/AGENTS.md")],
      [root]
    );

    const folders = Object.values(index).filter(
      (node) => node.isFolder && node.name === "app"
    );
    expect(folders).toHaveLength(1);
    expect(folders[0]?.childIds).toHaveLength(2);
  });

  it("sorts folders before files, then alphabetically", () => {
    const index = buildTree(
      [file(1, "z.md"), file(2, "a.md"), file(3, "sub/nested.md")],
      [root]
    );

    const branch = index[TREE_ROOT_ID]?.childIds[0] as string;
    const names = index[branch]?.childIds.map((id) => index[id]?.name);
    expect(names).toEqual(["sub", "a.md", "z.md"]);
  });

  it("keeps one branch per root", () => {
    const other: Root = {
      id: 2,
      path: "/Users/me/.claude",
      enabled: true,
      addedAt: 0,
    };
    const index = buildTree(
      [file(1, "CLAUDE.md"), file(2, "CLAUDE.md", 2)],
      [root, other]
    );

    const names = index[TREE_ROOT_ID]?.childIds.map((id) => index[id]?.name);
    expect(names).toEqual([".claude", "GitHub"]);
  });

  it("drops files whose root is gone", () => {
    const index = buildTree([file(1, "CLAUDE.md", 99)], [root]);

    expect(index[TREE_ROOT_ID]?.childIds).toEqual([]);
  });

  it("returns a lone root node for an empty index", () => {
    const index = buildTree([], [root]);

    expect(Object.keys(index)).toEqual([TREE_ROOT_ID]);
  });
});

describe("fileIdOf", () => {
  it("round-trips a file node id", () => {
    expect(fileIdOf(fileNodeId(42))).toBe(42);
  });

  it("returns null for a folder node", () => {
    expect(fileIdOf("dir:1:app")).toBeNull();
  });
});
