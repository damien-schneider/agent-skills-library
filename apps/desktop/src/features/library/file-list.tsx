import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { FileText, Folder, Link2 } from "lucide-react";
import { useMemo } from "react";
import { Virtualizer } from "virtua";

import type { FileRow, Root } from "@/lib/ipc-types";
import { cn } from "@/lib/utils";

export interface FileListProps {
  files: FileRow[];
  roots: Root[];
  selectedFileId: number | null;
  onSelectFile: (file: FileRow) => void;
}

interface FileGroup {
  id: string;
  label: string;
  path: string;
  files: FileRow[];
}

interface GroupRow {
  type: "group";
  id: string;
  label: string;
  path: string;
  count: number;
}

interface FileRowItem {
  type: "file";
  id: string;
  file: FileRow;
  groupPath: string;
}

type ListRow = GroupRow | FileRowItem;

const SEPARATOR_PATTERN = /[\\/]+/;
const TRAILING_SLASH_PATTERN = /\/$/;

function pathName(path: string): string {
  return path.split(SEPARATOR_PATTERN).filter(Boolean).at(-1) ?? path;
}

function fileName(file: FileRow): string {
  const segments = file.path.split(SEPARATOR_PATTERN).filter(Boolean);
  return file.kind === "claude-skill"
    ? (segments.at(-2) ?? segments.at(-1) ?? file.path)
    : (segments.at(-1) ?? file.path);
}

function relativeParentPath(file: FileRow, groupPath: string): string {
  const normalizedFilePath = file.path.replaceAll("\\", "/");
  const normalizedGroupPath = groupPath
    .replaceAll("\\", "/")
    .replace(TRAILING_SLASH_PATTERN, "");
  const relativePath = normalizedFilePath.startsWith(`${normalizedGroupPath}/`)
    ? normalizedFilePath.slice(normalizedGroupPath.length + 1)
    : file.relPath.replaceAll("\\", "/");
  const segments = relativePath.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/") || "Top level";
}

function buildRows(files: FileRow[], roots: Root[]): ListRow[] {
  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const groupsById = new Map<string, FileGroup>();

  for (const file of files) {
    const root = rootsById.get(file.rootId);
    if (!root) {
      continue;
    }

    const path = file.projectDir ?? root.path;
    const id = `${file.projectDir ? "project" : "root"}:${path}`;
    const group = groupsById.get(id) ?? {
      id,
      label: pathName(path),
      path,
      files: [],
    };
    group.files.push(file);
    groupsById.set(id, group);
  }

  const groups = [...groupsById.values()].sort(
    (left, right) =>
      left.label.localeCompare(right.label) ||
      left.path.localeCompare(right.path)
  );
  const rows: ListRow[] = [];

  for (const group of groups) {
    group.files.sort((left, right) => left.path.localeCompare(right.path));
    rows.push({
      type: "group",
      id: group.id,
      label: group.label,
      path: group.path,
      count: group.files.length,
    });
    for (const file of group.files) {
      rows.push({
        type: "file",
        id: `file:${file.id}`,
        file,
        groupPath: group.path,
      });
    }
  }

  return rows;
}

export function FileList({
  files,
  roots,
  selectedFileId,
  onSelectFile,
}: FileListProps) {
  const rows = useMemo(() => buildRows(files, roots), [files, roots]);

  return (
    <section aria-label="Indexed agent files" className="h-full overflow-auto">
      <Virtualizer data={rows}>
        {(row) =>
          row.type === "group" ? (
            <div
              className="flex h-8 items-center gap-1.5 bg-muted/50 px-3 text-xs"
              key={row.id}
              role="presentation"
              title={row.path}
            >
              <Folder className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate font-medium">{row.label}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                {row.path}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {row.count}
              </span>
            </div>
          ) : (
            <button
              aria-pressed={selectedFileId === row.file.id}
              className={cn(
                "flex h-11 w-full items-center gap-2 px-3 text-left outline-none transition-colors motion-reduce:transition-none",
                selectedFileId === row.file.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 focus-visible:bg-accent/50"
              )}
              key={row.id}
              onClick={() => onSelectFile(row.file)}
              title={row.file.path}
              type="button"
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm">{fileName(row.file)}</span>
                  {row.file.isSymlink ? (
                    <Link2 className="size-3 shrink-0 text-chart-3" />
                  ) : null}
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {targetLabel(row.file.kind)}
                  </span>
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {row.file.kind === "claude-skill"
                    ? `${relativeParentPath(row.file, row.groupPath)}/SKILL.md`
                    : relativeParentPath(row.file, row.groupPath)}
                </span>
              </span>
            </button>
          )
        }
      </Virtualizer>
    </section>
  );
}
