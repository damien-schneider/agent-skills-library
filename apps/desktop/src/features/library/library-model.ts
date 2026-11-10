import type { FileRow, Root } from "@/lib/ipc-types";

/** A folder of the library that holds several files, e.g. a `skills` directory. */
export interface LibraryCollection {
  id: string;
  label: string;
  path: string;
  /** Path from the scope down to this folder; empty at the scope's top level. */
  relativePath: string;
  files: FileRow[];
}

/** A project (or an indexed folder outside any project) and everything found in it. */
export interface LibraryScope {
  id: string;
  label: string;
  path: string;
  files: FileRow[];
  collections: LibraryCollection[];
}

export interface LibraryLocation {
  scopeId: string;
  collectionId: string;
}

export interface LibraryModel {
  scopes: LibraryScope[];
  locationsByFileId: Map<number, LibraryLocation>;
}

const SEPARATOR_PATTERN = /[\\/]+/;
const TRAILING_SLASH_PATTERN = /\/$/;
const WHITESPACE_PATTERN = /\s+/;

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
export function fileTitle(file: FileRow): string {
  return file.kind === "skill"
    ? pathName(parentPath(file.path))
    : pathName(file.path);
}

/** The folder a file is listed under; a skill is listed under its folder's parent. */
function collectionPath(file: FileRow): string {
  const immediateParent = parentPath(file.path);
  return file.kind === "skill" ? parentPath(immediateParent) : immediateParent;
}

export function buildLibraryModel(
  files: readonly FileRow[],
  roots: readonly Root[],
  favoritePaths: ReadonlySet<string> = new Set()
): LibraryModel {
  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const scopesById = new Map<string, LibraryScope>();
  const collectionsById = new Map<string, LibraryCollection>();
  const locationsByFileId = new Map<number, LibraryLocation>();

  for (const file of files) {
    const root = rootsById.get(file.rootId);
    if (!root) {
      continue;
    }

    const scopePath = file.projectDir ?? root.path;
    const scopeId = `scope:${scopePath}`;
    let scope = scopesById.get(scopeId);
    if (!scope) {
      scope = {
        id: scopeId,
        label: pathName(scopePath),
        path: scopePath,
        files: [],
        collections: [],
      };
      scopesById.set(scopeId, scope);
    }

    const folderPath = collectionPath(file);
    const collectionId = `${scopeId}:folder:${folderPath}`;
    let collection = collectionsById.get(collectionId);
    if (!collection) {
      const folderRelativePath = relativePath(folderPath, scopePath);
      collection = {
        id: collectionId,
        label: folderRelativePath === "" ? scope.label : pathName(folderPath),
        path: folderPath,
        relativePath: folderRelativePath,
        files: [],
      };
      collectionsById.set(collectionId, collection);
      scope.collections.push(collection);
    }

    scope.files.push(file);
    collection.files.push(file);
    locationsByFileId.set(file.id, { scopeId, collectionId });
  }

  const scopes = [...scopesById.values()].sort(
    (left, right) =>
      Number(favoritePaths.has(right.path)) -
        Number(favoritePaths.has(left.path)) ||
      left.label.localeCompare(right.label) ||
      left.path.localeCompare(right.path)
  );
  for (const scope of scopes) {
    scope.collections.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath)
    );
    for (const collection of scope.collections) {
      collection.files.sort((left, right) =>
        fileTitle(left).localeCompare(fileTitle(right))
      );
    }
  }

  return { scopes, locationsByFileId };
}

/** Matches every whitespace-separated term against a file's name, path, and description. */
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
      `${file.path} ${file.name ?? ""} ${file.description ?? ""}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
