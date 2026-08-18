import type { DestinationFolder } from "@/lib/ipc-types";

const ABSOLUTE_PATH_PATTERN = /^[~/]/;
const WHITESPACE_PATTERN = /\s+/;

export type DestinationSectionId = "favorite" | "recent" | "project";

export interface DestinationSection {
  id: DestinationSectionId;
  label: string;
  folders: DestinationFolder[];
  hidden: number;
}

/** Deep trees eat the width of the composer: `~` keeps the meaningful part visible. */
export function displayPath(path: string, home: string | null): string {
  if (home === null || !path.startsWith(home)) {
    return path;
  }
  const rest = path.slice(home.length);
  return rest === "" || rest.startsWith("/") ? `~${rest}` : path;
}

export function folderName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

/** The folder name never truncates, only the tree above it does. */
export function destinationParts(
  path: string,
  home: string | null
): { name: string; parent: string } {
  const display = displayPath(path, home);
  const separator = display.lastIndexOf("/");
  return separator === -1
    ? { name: display, parent: "" }
    : {
        name: display.slice(separator + 1),
        parent: display.slice(0, separator),
      };
}

export function looksLikePath(query: string): boolean {
  return ABSOLUTE_PATH_PATTERN.test(query.trim());
}

/** A path pasted in full has to match the folder it names, whether or not the
 * list shows it shortened to `~`. */
function matches(
  folder: DestinationFolder,
  tokens: string[],
  home: string | null
) {
  const shortened = displayPath(folder.path, home).toLowerCase();
  const full = folder.path.toLowerCase();
  return tokens.every(
    (token) => shortened.includes(token) || full.includes(token)
  );
}

function sectionOf(folder: DestinationFolder): DestinationSectionId {
  if (folder.favorite) {
    return "favorite";
  }
  return folder.lastUsedAt === null ? "project" : "recent";
}

function byRecency(left: DestinationFolder, right: DestinationFolder) {
  return (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0);
}

function byRelevance(left: DestinationFolder, right: DestinationFolder) {
  return (
    right.fileCount - left.fileCount ||
    folderName(left.path).localeCompare(folderName(right.path))
  );
}

interface SectionRule {
  id: DestinationSectionId;
  label: string;
  limit: (searching: boolean) => number;
  sort: (left: DestinationFolder, right: DestinationFolder) => number;
}

const SECTIONS: SectionRule[] = [
  {
    id: "favorite",
    label: "Favorites",
    limit: () => Number.POSITIVE_INFINITY,
    sort: (left, right) =>
      byRecency(left, right) ||
      folderName(left.path).localeCompare(folderName(right.path)),
  },
  {
    id: "recent",
    label: "Recent",
    limit: (searching) => (searching ? 12 : 5),
    sort: byRecency,
  },
  {
    id: "project",
    label: "Projects",
    limit: (searching) => (searching ? 40 : 8),
    sort: byRelevance,
  },
];

/**
 * Starred and previously used folders survive in the list once they vanish from
 * disk — they were put there on purpose, and have to be recognisable to be
 * cleaned up. An indexed project that vanished is just a stale row: it goes.
 */
export function destinationSections(
  folders: DestinationFolder[],
  query: string,
  home: string | null
): DestinationSection[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(WHITESPACE_PATTERN)
    .filter(Boolean);
  const searching = tokens.length > 0;
  const visible = folders.filter(
    (folder) =>
      (folder.available || sectionOf(folder) !== "project") &&
      matches(folder, tokens, home)
  );

  return SECTIONS.map(({ id, label, limit, sort }) => {
    const matched = visible
      .filter((folder) => sectionOf(folder) === id)
      .sort(sort);
    return {
      id,
      label,
      folders: matched.slice(0, limit(searching)),
      hidden: Math.max(0, matched.length - limit(searching)),
    };
  }).filter((section) => section.folders.length > 0);
}
