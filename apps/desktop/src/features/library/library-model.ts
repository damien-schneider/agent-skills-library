import type { FileKind, FileRow, Root } from "@/lib/ipc-types";
import { fileNodeId } from "@/lib/tree";

/** One row of the library: a file where it lives, or where a link makes it show up. */
export interface LibraryEntry {
  /** Tree value; unique per row even when one file shows in several places. */
  id: string;
  file: FileRow;
  /** Where this row's file is reached: its own path, or the link's. */
  path: string;
  /** Reached through a symbolic link rather than living here. */
  linked: boolean;
}

/** A folder of the library that holds several files, e.g. a `skills` directory. */
export interface LibraryCollection {
  id: string;
  label: string;
  path: string;
  /** Path from the scope down to this folder; empty at the scope's top level. */
  relativePath: string;
  entries: LibraryEntry[];
}

/**
 * `personal`: an agent's home folder (`~/.claude`), whose skills every project gets.
 * `project`: a repository, or an indexed folder outside any agent home.
 * `worktree`: a second checkout of a repository.
 */
export type LibraryScopeKind = "personal" | "project" | "worktree";

/** A place the library groups files by, and everything found in it. */
export interface LibraryScope {
  id: string;
  kind: LibraryScopeKind;
  label: string;
  path: string;
  entryCount: number;
  collections: LibraryCollection[];
}

export interface LibraryLocation {
  scopeId: string;
  collectionId: string;
}

export interface LibraryModel {
  /** Agent home folders, in the order of `AGENT_HOMES`. */
  personal: LibraryScope[];
  /** Repositories and other folders: favorites first, then by name. */
  projects: LibraryScope[];
  locationsByEntryId: Map<string, LibraryLocation>;
}

const SEPARATOR_PATTERN = /[\\/]+/;
const TRAILING_SLASH_PATTERN = /\/$/;
const WHITESPACE_PATTERN = /\s+/;
/** Claude Code's worktrees, and the conventional `.worktrees` folder. */
const WORKTREE_PATTERN = /^(.+)\/(?:\.claude\/worktrees|\.worktrees)\/([^/]+)$/;

/** Folders in the user's home that an agent reads per-user files from, in display order. */
const AGENT_HOMES: readonly (readonly [string, string])[] = [
  [".claude", "Claude Code"],
  [".agents", "Shared agents"],
  [".codex", "Codex"],
  [".cursor", "Cursor"],
  [".gemini", "Gemini"],
  [".config/opencode", "OpenCode"],
];

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(TRAILING_SLASH_PATTERN, "");
}

export function pathName(path: string): string {
  return path.split(SEPARATOR_PATTERN).filter(Boolean).at(-1) ?? path;
}

export function parentPath(path: string): string {
  const normalizedPath = normalizePath(path);
  const separatorIndex = normalizedPath.lastIndexOf("/");
  return separatorIndex <= 0
    ? normalizedPath
    : normalizedPath.slice(0, separatorIndex);
}

function isWithin(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

function relativePath(path: string, basePath: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedBasePath = normalizePath(basePath);
  if (normalizedPath === normalizedBasePath) {
    return "";
  }
  return normalizedPath.startsWith(`${normalizedBasePath}/`)
    ? normalizedPath.slice(normalizedBasePath.length + 1)
    : normalizedPath;
}

/** A skill is its folder: `SKILL.md` alone would name every skill the same. */
function titleAt(kind: FileKind, path: string): string {
  return kind === "skill" ? pathName(parentPath(path)) : pathName(path);
}

export function fileTitle(file: FileRow): string {
  return titleAt(file.kind, file.path);
}

export function entryTitle(entry: LibraryEntry): string {
  return titleAt(entry.file.kind, entry.path);
}

/** The folder a row is listed under; a skill is listed under its folder's parent. */
function collectionPath(kind: FileKind, path: string): string {
  const immediateParent = parentPath(path);
  return kind === "skill" ? parentPath(immediateParent) : immediateParent;
}

/** An agent's per-user folder, e.g. `~/.claude`. */
interface AgentHome {
  path: string;
  label: string;
  rank: number;
}

/** The agent home folder in `home` that a path sits in. */
function agentHomeOf(path: string, home: string | null): AgentHome | null {
  if (home === null) {
    return null;
  }
  for (const [rank, [relative, label]] of AGENT_HOMES.entries()) {
    const homePath = `${normalizePath(home)}/${relative}`;
    if (isWithin(normalizePath(path), homePath)) {
      return { path: homePath, label, rank };
    }
  }
  return null;
}

function projectScope(path: string): Omit<LibraryScope, "collections" | "id"> {
  const worktree = WORKTREE_PATTERN.exec(path);
  if (worktree?.[1] && worktree[2]) {
    return {
      kind: "worktree",
      label: `${pathName(worktree[1])} › ${worktree[2]}`,
      path,
      entryCount: 0,
    };
  }
  return { kind: "project", label: pathName(path), path, entryCount: 0 };
}

function personalScope(
  agentHome: AgentHome
): Omit<LibraryScope, "collections" | "id"> {
  return {
    kind: "personal",
    label: agentHome.label,
    path: agentHome.path,
    entryCount: 0,
  };
}

class ModelBuilder {
  readonly scopes = new Map<string, LibraryScope>();
  readonly collections = new Map<string, LibraryCollection>();
  readonly locations = new Map<string, LibraryLocation>();

  add(
    scopeInfo: Omit<LibraryScope, "collections" | "id">,
    entry: LibraryEntry
  ): void {
    const scopeId = `scope:${scopeInfo.path}`;
    let scope = this.scopes.get(scopeId);
    if (!scope) {
      scope = { ...scopeInfo, id: scopeId, collections: [] };
      this.scopes.set(scopeId, scope);
    }

    const folderPath = collectionPath(entry.file.kind, entry.path);
    const collectionId = `${scopeId}:folder:${folderPath}`;
    let collection = this.collections.get(collectionId);
    if (!collection) {
      const folderRelativePath = relativePath(folderPath, scope.path);
      collection = {
        id: collectionId,
        label: folderRelativePath === "" ? scope.label : pathName(folderPath),
        path: folderPath,
        relativePath: folderRelativePath,
        entries: [],
      };
      this.collections.set(collectionId, collection);
      scope.collections.push(collection);
    }

    scope.entryCount += 1;
    collection.entries.push(entry);
    this.locations.set(entry.id, { scopeId, collectionId });
  }
}

function sortScope(scope: LibraryScope): void {
  scope.collections.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  );
  for (const collection of scope.collections) {
    collection.entries.sort((left, right) =>
      entryTitle(left).localeCompare(entryTitle(right))
    );
  }
}

/**
 * Splits the library into what every project gets (agent home folders) and what
 * each repository brings. A skill linked into an agent home from a repository
 * shows in both: where it is installed, and where it is maintained.
 */
export function buildLibraryModel(
  files: readonly FileRow[],
  roots: readonly Root[],
  /** The user's home folder; `null` lists everything under Projects. */
  home: string | null,
  favoritePaths: ReadonlySet<string> = new Set()
): LibraryModel {
  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const builder = new ModelBuilder();
  const ranks = new Map<string, number>();

  for (const file of files) {
    const root = rootsById.get(file.rootId);
    if (!root) {
      continue;
    }
    const id = fileNodeId(file.id);
    const agentHome = agentHomeOf(file.path, home);
    if (agentHome) {
      ranks.set(agentHome.path, agentHome.rank);
    }
    builder.add(
      agentHome
        ? personalScope(agentHome)
        : projectScope(file.projectDir ?? root.path),
      { id, file, path: file.path, linked: false }
    );

    for (const alias of file.aliases) {
      const aliasHome = agentHomeOf(alias, home);
      if (aliasHome) {
        ranks.set(aliasHome.path, aliasHome.rank);
        builder.add(personalScope(aliasHome), {
          id: `${id}@${alias}`,
          file,
          path: alias,
          linked: true,
        });
      }
    }
  }

  const scopes = [...builder.scopes.values()];
  for (const scope of scopes) {
    sortScope(scope);
  }
  const homeRank = (scope: LibraryScope) => ranks.get(scope.path) ?? 0;

  return {
    personal: scopes
      .filter((scope) => scope.kind === "personal")
      .sort(
        (left, right) =>
          homeRank(left) - homeRank(right) ||
          left.path.localeCompare(right.path)
      ),
    projects: scopes
      .filter((scope) => scope.kind !== "personal")
      .sort(
        (left, right) =>
          Number(favoritePaths.has(right.path)) -
            Number(favoritePaths.has(left.path)) ||
          left.label.localeCompare(right.label) ||
          left.path.localeCompare(right.path)
      ),
    locationsByEntryId: builder.locations,
  };
}

/** Matches every whitespace-separated term against a file's name, paths, and description. */
export function filterFiles(
  files: readonly FileRow[],
  query: string
): FileRow[] {
  const terms = query.toLowerCase().split(WHITESPACE_PATTERN).filter(Boolean);
  if (terms.length === 0) {
    return [...files];
  }
  return files.filter((file) => {
    const haystack =
      `${file.path} ${file.aliases.join(" ")} ${file.name ?? ""} ${file.description ?? ""}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
