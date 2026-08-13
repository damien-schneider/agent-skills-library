import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { ChevronRight, FileText, Folder, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { FileRow, Root } from "@/lib/ipc-types";
import { cn } from "@/lib/utils";

export interface FileListProps {
  files: FileRow[];
  roots: Root[];
  selectedFileId: number | null;
  expandAll?: boolean;
  onSelectFile: (file: FileRow) => void;
}

interface FileCollection {
  id: string;
  label: string;
  path: string;
  relativePath: string;
  files: FileRow[];
}

interface FileScope {
  id: string;
  label: string;
  path: string;
  files: FileRow[];
  collections: FileCollection[];
}

interface FileLocation {
  scopeId: string;
  collectionId: string;
}

interface FileListModel {
  scopes: FileScope[];
  locationsByFileId: Map<number, FileLocation>;
}

const SEPARATOR_PATTERN = /[\\/]+/;
const TRAILING_SLASH_PATTERN = /\/$/;

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(TRAILING_SLASH_PATTERN, "");
}

function pathName(path: string): string {
  return path.split(SEPARATOR_PATTERN).filter(Boolean).at(-1) ?? path;
}

function parentPath(path: string): string {
  const normalizedPath = normalizePath(path);
  const separatorIndex = normalizedPath.lastIndexOf("/");
  return separatorIndex <= 0
    ? normalizedPath
    : normalizedPath.slice(0, separatorIndex);
}

function collectionPath(file: FileRow): string {
  const immediateParent = parentPath(file.path);
  return file.kind === "claude-skill"
    ? parentPath(immediateParent)
    : immediateParent;
}

function relativePath(path: string, basePath: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedBasePath = normalizePath(basePath);
  return normalizedPath.startsWith(`${normalizedBasePath}/`)
    ? normalizedPath.slice(normalizedBasePath.length + 1)
    : normalizedPath;
}

function itemName(file: FileRow): string {
  return file.kind === "claude-skill"
    ? pathName(parentPath(file.path))
    : pathName(file.path);
}

function buildModel(files: FileRow[], roots: Root[]): FileListModel {
  const rootsById = new Map(roots.map((root) => [root.id, root]));
  const scopesById = new Map<string, FileScope>();
  const collectionsById = new Map<string, FileCollection>();
  const locationsByFileId = new Map<number, FileLocation>();

  for (const file of files) {
    const root = rootsById.get(file.rootId);
    if (!root) {
      continue;
    }

    const scopePath = file.projectDir ?? root.path;
    const scopeId = `${file.projectDir ? "project" : "root"}:${scopePath}`;
    const scope = scopesById.get(scopeId) ?? {
      id: scopeId,
      label: pathName(scopePath),
      path: scopePath,
      files: [],
      collections: [],
    };
    const folderPath = collectionPath(file);
    const collectionId = `${scopeId}:folder:${folderPath}`;
    const folderRelativePath =
      relativePath(folderPath, scopePath) || "Top level";
    const collection = collectionsById.get(collectionId) ?? {
      id: collectionId,
      label:
        folderRelativePath === "Top level" ? "Top level" : pathName(folderPath),
      path: folderPath,
      relativePath: folderRelativePath,
      files: [],
    };

    scope.files.push(file);
    collection.files.push(file);
    if (!scopesById.has(scopeId)) {
      scopesById.set(scopeId, scope);
    }
    if (!collectionsById.has(collectionId)) {
      collectionsById.set(collectionId, collection);
      scope.collections.push(collection);
    }
    locationsByFileId.set(file.id, { scopeId, collectionId });
  }

  const scopes = [...scopesById.values()].sort(
    (left, right) =>
      left.label.localeCompare(right.label) ||
      left.path.localeCompare(right.path)
  );
  for (const scope of scopes) {
    scope.collections.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath)
    );
    for (const collection of scope.collections) {
      collection.files.sort((left, right) =>
        itemName(left).localeCompare(itemName(right))
      );
    }
  }

  return { scopes, locationsByFileId };
}

function updateExpanded(
  current: Set<string>,
  id: string,
  expanded: boolean
): Set<string> {
  const next = new Set(current);
  if (expanded) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

function FileItem({
  context,
  file,
  indented,
  selected,
  onSelect,
}: {
  context: string | null;
  file: FileRow;
  indented: boolean;
  selected: boolean;
  onSelect: (file: FileRow) => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex h-9 w-full items-center gap-2 pr-3 text-left outline-none transition-colors motion-reduce:transition-none",
        indented ? "pl-9" : "pl-5",
        selected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 focus-visible:bg-accent/50"
      )}
      onClick={() => onSelect(file)}
      title={file.path}
      type="button"
    >
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-sm">{itemName(file)}</span>
      {file.isSymlink ? (
        <Link2 className="size-3 shrink-0 text-chart-3" />
      ) : null}
      {context ? (
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          {context}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {targetLabel(file.kind)}
      </span>
    </button>
  );
}

function CollectionGroup({
  collection,
  expanded,
  expandAll,
  selectedFileId,
  onExpandedChange,
  onSelectFile,
}: {
  collection: FileCollection;
  expanded: boolean;
  expandAll: boolean;
  selectedFileId: number | null;
  onExpandedChange: (id: string, expanded: boolean) => void;
  onSelectFile: (file: FileRow) => void;
}) {
  const containsSelection = collection.files.some(
    (file) => file.id === selectedFileId
  );

  return (
    <div>
      <button
        aria-expanded={expanded}
        className={cn(
          "flex h-9 w-full items-center gap-2 px-3 pl-5 text-left text-xs outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 motion-reduce:transition-none",
          containsSelection && !expanded && "bg-accent/30"
        )}
        disabled={expandAll}
        onClick={() => onExpandedChange(collection.id, !expanded)}
        title={collection.path}
        type="button"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            expanded && "rotate-90"
          )}
        />
        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-medium">{collection.label}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          {collection.relativePath}
        </span>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {collection.files.length}
        </span>
      </button>
      {expanded
        ? collection.files.map((file) => (
            <FileItem
              context={null}
              file={file}
              indented={true}
              key={file.id}
              onSelect={onSelectFile}
              selected={file.id === selectedFileId}
            />
          ))
        : null}
    </div>
  );
}

function CollectionItems({
  collection,
  expandedIds,
  expandAll,
  selectedFileId,
  onExpandedChange,
  onSelectFile,
}: {
  collection: FileCollection;
  expandedIds: Set<string>;
  expandAll: boolean;
  selectedFileId: number | null;
  onExpandedChange: (id: string, expanded: boolean) => void;
  onSelectFile: (file: FileRow) => void;
}) {
  const firstFile = collection.files[0];
  if (!firstFile) {
    return null;
  }

  return collection.files.length === 1 ? (
    <FileItem
      context={collection.relativePath}
      file={firstFile}
      indented={false}
      onSelect={onSelectFile}
      selected={firstFile.id === selectedFileId}
    />
  ) : (
    <CollectionGroup
      collection={collection}
      expandAll={expandAll}
      expanded={expandAll || expandedIds.has(collection.id)}
      onExpandedChange={onExpandedChange}
      onSelectFile={onSelectFile}
      selectedFileId={selectedFileId}
    />
  );
}

function ScopeGroup({
  scope,
  expanded,
  expandedIds,
  expandAll,
  selectedFileId,
  onExpandedChange,
  onSelectFile,
}: {
  scope: FileScope;
  expanded: boolean;
  expandedIds: Set<string>;
  expandAll: boolean;
  selectedFileId: number | null;
  onExpandedChange: (id: string, expanded: boolean) => void;
  onSelectFile: (file: FileRow) => void;
}) {
  const containsSelection = scope.files.some(
    (file) => file.id === selectedFileId
  );

  return (
    <div className="border-border border-b">
      <button
        aria-expanded={expanded}
        className={cn(
          "flex h-10 w-full items-center gap-2 bg-muted/45 px-3 text-left text-xs outline-none transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 motion-reduce:transition-none",
          containsSelection && !expanded && "bg-accent/50"
        )}
        disabled={expandAll}
        onClick={() => onExpandedChange(scope.id, !expanded)}
        title={scope.path}
        type="button"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            expanded && "rotate-90"
          )}
        />
        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-semibold">{scope.label}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
          {scope.path}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {scope.files.length}
        </span>
      </button>
      {expanded
        ? scope.collections.map((collection) => (
            <CollectionItems
              collection={collection}
              expandAll={expandAll}
              expandedIds={expandedIds}
              key={collection.id}
              onExpandedChange={onExpandedChange}
              onSelectFile={onSelectFile}
              selectedFileId={selectedFileId}
            />
          ))
        : null}
    </div>
  );
}

export function FileList({
  files,
  roots,
  selectedFileId,
  expandAll = false,
  onSelectFile,
}: FileListProps) {
  const model = useMemo(() => buildModel(files, roots), [files, roots]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(model.scopes.length === 1 ? [model.scopes[0]?.id ?? ""] : [])
  );

  useEffect(() => {
    if (selectedFileId === null) {
      return;
    }
    const location = model.locationsByFileId.get(selectedFileId);
    if (!location) {
      return;
    }
    setExpandedIds((current) => {
      const withScope = updateExpanded(current, location.scopeId, true);
      return updateExpanded(withScope, location.collectionId, true);
    });
  }, [model.locationsByFileId, selectedFileId]);

  const handleExpandedChange = (id: string, expanded: boolean) => {
    setExpandedIds((current) => updateExpanded(current, id, expanded));
  };

  return (
    <section aria-label="Indexed agent files" className="h-full overflow-auto">
      {model.scopes.map((scope) => (
        <ScopeGroup
          expandAll={expandAll}
          expanded={expandAll || expandedIds.has(scope.id)}
          expandedIds={expandedIds}
          key={scope.id}
          onExpandedChange={handleExpandedChange}
          onSelectFile={onSelectFile}
          scope={scope}
          selectedFileId={selectedFileId}
        />
      ))}
    </section>
  );
}
