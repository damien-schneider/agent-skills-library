import type { FileRow, Root } from "./ipc-types";

export const TREE_ROOT_ID = "root";

export interface TreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  file: FileRow | null;
  childIds: string[];
}

export type TreeIndex = Record<string, TreeNode>;

const SEPARATOR_PATTERN = /[\\/]+/;

export function fileNodeId(fileId: number): string {
  return `file:${fileId}`;
}

export function fileIdOf(nodeId: string): number | null {
  const raw = nodeId.startsWith("file:") ? nodeId.slice(5) : null;
  if (raw === null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function folderNodeId(rootId: number, segments: string[]): string {
  return `dir:${rootId}:${segments.join("/")}`;
}

function ensureNode(index: TreeIndex, node: TreeNode): TreeNode {
  const existing = index[node.id];
  if (existing) {
    return existing;
  }
  index[node.id] = node;
  return node;
}

function attach(parent: TreeNode, childId: string) {
  if (!parent.childIds.includes(childId)) {
    parent.childIds.push(childId);
  }
}

function rootLabel(root: Root): string {
  const segments = root.path.split(SEPARATOR_PATTERN).filter(Boolean);
  return segments.at(-1) ?? root.path;
}

function sortChildren(index: TreeIndex) {
  for (const node of Object.values(index)) {
    node.childIds.sort((left, right) => {
      const a = index[left];
      const b = index[right];
      if (!(a && b)) {
        return 0;
      }
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
}

/** One folder branch per root, then `relPath` segments; leaves carry their FileRow. */
export function buildTree(files: FileRow[], roots: Root[]): TreeIndex {
  const index: TreeIndex = {
    [TREE_ROOT_ID]: {
      id: TREE_ROOT_ID,
      name: "",
      isFolder: true,
      file: null,
      childIds: [],
    },
  };

  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const usedRootIds = new Set(files.map((file) => file.rootId));

  for (const rootId of usedRootIds) {
    const root = rootsById.get(rootId);
    if (!root) {
      continue;
    }
    const node = ensureNode(index, {
      id: folderNodeId(rootId, []),
      name: rootLabel(root),
      isFolder: true,
      file: null,
      childIds: [],
    });
    attach(index[TREE_ROOT_ID] as TreeNode, node.id);
  }

  for (const file of files) {
    if (!rootsById.has(file.rootId)) {
      continue;
    }
    const segments = file.relPath.split(SEPARATOR_PATTERN).filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) {
      continue;
    }

    let parent = index[folderNodeId(file.rootId, [])];
    if (!parent) {
      continue;
    }

    const walked: string[] = [];
    for (const segment of segments) {
      walked.push(segment);
      const folder = ensureNode(index, {
        id: folderNodeId(file.rootId, walked),
        name: segment,
        isFolder: true,
        file: null,
        childIds: [],
      });
      attach(parent, folder.id);
      parent = folder;
    }

    const leaf = ensureNode(index, {
      id: fileNodeId(file.id),
      name: fileName,
      isFolder: false,
      file,
      childIds: [],
    });
    attach(parent, leaf.id);
  }

  sortChildren(index);
  return index;
}

export function expandedFolderIds(index: TreeIndex): string[] {
  return Object.values(index)
    .filter((node) => node.isFolder && node.id !== TREE_ROOT_ID)
    .map((node) => node.id);
}
