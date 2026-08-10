export type FileKind =
  | "agents-md"
  | "claude-md"
  | "gemini-md"
  | "cursor-rule"
  | "claude-skill"
  | "claude-agent";

export interface ScanTarget {
  kind: FileKind;
  label: string;
  /** exact file names, case-sensitive; omitted when `extension` drives the match */
  fileNames?: readonly string[];
  extension?: string;
  /** consecutive parent segments the file must live under, POSIX separators */
  ancestorDir?: string;
}

/** Rust mirror: src-tauri/src/scanner/targets.rs — both sides are frozen by a test */
export const SCAN_TARGETS: readonly ScanTarget[] = [
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
] as const;

/** Walked-over directories — not gitignore-driven: repos often ignore `.claude/` */
export const SKIP_DIRS: readonly string[] = [
  ".git",
  ".hg",
  ".svn",
  ".jj",
  "node_modules",
  "target",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
  "vendor",
  ".gradle",
  "Pods",
  ".terraform",
  "coverage",
] as const;

const SEPARATOR_PATTERN = /[\\/]+/;

function toSegments(path: string): string[] {
  return path.split(SEPARATOR_PATTERN).filter(Boolean);
}

function hasAncestorDir(
  parentSegments: readonly string[],
  ancestorDir: string
): boolean {
  const needle = toSegments(ancestorDir);
  if (needle.length === 0 || needle.length > parentSegments.length) {
    return false;
  }

  for (let start = 0; start <= parentSegments.length - needle.length; start++) {
    if (needle.every((seg, offset) => parentSegments[start + offset] === seg)) {
      return true;
    }
  }
  return false;
}

function matchesTarget(
  target: ScanTarget,
  fileName: string,
  parentSegments: readonly string[]
): boolean {
  if (
    target.ancestorDir &&
    !hasAncestorDir(parentSegments, target.ancestorDir)
  ) {
    return false;
  }
  if (target.fileNames) {
    return target.fileNames.includes(fileName);
  }
  if (target.extension) {
    return fileName.endsWith(target.extension);
  }
  return false;
}

export function classifyPath(path: string): FileKind | null {
  const segments = toSegments(path);
  const fileName = segments.at(-1);
  if (!fileName) {
    return null;
  }

  const parentSegments = segments.slice(0, -1);
  for (const target of SCAN_TARGETS) {
    if (matchesTarget(target, fileName, parentSegments)) {
      return target.kind;
    }
  }
  return null;
}

export function isSkippedDir(dirName: string): boolean {
  return SKIP_DIRS.includes(dirName);
}

export function targetLabel(kind: FileKind): string {
  return SCAN_TARGETS.find((target) => target.kind === kind)?.label ?? kind;
}
