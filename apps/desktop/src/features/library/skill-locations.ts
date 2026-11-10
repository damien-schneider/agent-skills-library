import type { FileRow, Root } from "@/lib/ipc-types";

import { parentPath } from "./library-model";

/** A directory that holds skill folders, e.g. `~/.claude/skills`. */
export interface SkillLocation {
  path: string;
  /** Skills already living there; zero for a suggested but still empty location. */
  skillCount: number;
  /** True for the per-user folders every project of that agent reads. */
  personal: boolean;
}

/** Where agents look for per-user skills, most widely supported first. */
const PERSONAL_SKILL_DIRS = [".claude/skills", ".agents/skills"] as const;

export function isInsideRoots(path: string, roots: readonly Root[]): boolean {
  return roots.some(
    (root) =>
      root.enabled && (path === root.path || path.startsWith(`${root.path}/`))
  );
}

/**
 * Every place a new skill can go without the user typing a path: the folders
 * that already hold skills, plus the personal folders the indexed home allows.
 * Personal folders lead in the order agents support them, then the busiest folders.
 */
export function skillLocations(
  files: readonly FileRow[],
  roots: readonly Root[],
  home: string | null
): SkillLocation[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.kind === "skill") {
      const location = parentPath(parentPath(file.path));
      counts.set(location, (counts.get(location) ?? 0) + 1);
    }
  }

  const personalRanks = new Map<string, number>();
  if (home !== null) {
    for (const [rank, relative] of PERSONAL_SKILL_DIRS.entries()) {
      const path = `${home}/${relative}`;
      if (isInsideRoots(path, roots)) {
        personalRanks.set(path, rank);
        counts.set(path, counts.get(path) ?? 0);
      }
    }
  }

  const unranked = PERSONAL_SKILL_DIRS.length;
  return [...counts]
    .map(([path, skillCount]) => ({
      path,
      skillCount,
      personal: personalRanks.has(path),
    }))
    .sort(
      (left, right) =>
        (personalRanks.get(left.path) ?? unranked) -
          (personalRanks.get(right.path) ?? unranked) ||
        right.skillCount - left.skillCount ||
        left.path.localeCompare(right.path)
    );
}

/** The absolute path of the `SKILL.md` a skill named `name` gets in `location`. */
export function skillFilePath(location: string, name: string): string {
  return `${location}/${name}/SKILL.md`;
}
