import {
  Tree,
  TreeItem,
  TreeItemContent,
  TreeItemIndicator,
  TreeItemLabel,
  TreeItemTrigger,
} from "@ctrl-ui/react/ui/tree";
import { Text } from "@ctrl-ui/react/ui/typography";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { Link2, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { FileRow, Root } from "@/lib/ipc-types";
import {
  buildTree,
  fileIdOf,
  fileNodeId,
  TREE_ROOT_ID,
  type TreeIndex,
} from "@/lib/tree";

import { FileKindIcon } from "./file-kind";
import {
  buildLibraryModel,
  fileTitle,
  type LibraryCollection,
  type LibraryScope,
} from "./library-model";

export type LibraryTreeMode = "grouped" | "folders";

export interface LibraryTreeProps {
  files: FileRow[];
  roots: Root[];
  mode: LibraryTreeMode;
  selectedFileId: number | null;
  favoritePaths: ReadonlySet<string>;
  /** Shows every branch open, as while a search narrows the list. */
  expandAll: boolean;
  onSelectFile: (file: FileRow) => void;
}

const ICON_CLASS = "size-3.5 shrink-0 text-muted-foreground";

function FileItem({ file, context }: { file: FileRow; context?: string }) {
  const title = fileTitle(file);
  const linkCount = file.aliases.length;
  return (
    <TreeItem label={title} value={fileNodeId(file.id)}>
      <TreeItemTrigger title={file.path}>
        <TreeItemIndicator />
        <FileKindIcon className={ICON_CLASS} kind={file.kind} />
        <TreeItemLabel className="flex-initial">{title}</TreeItemLabel>
        <Text
          as="span"
          className="min-w-0 flex-1 truncate"
          size="caption"
          tone="muted"
        >
          {context ?? (file.kind === "skill" ? "" : targetLabel(file.kind))}
        </Text>
        {linkCount > 0 || file.isSymlink ? (
          <Link2
            aria-label={
              file.isSymlink
                ? "Symbolic link"
                : `Linked from ${linkCount} other ${linkCount === 1 ? "location" : "locations"}`
            }
            className={ICON_CLASS}
            role="img"
          />
        ) : null}
      </TreeItemTrigger>
    </TreeItem>
  );
}

function Count({ value }: { value: number }) {
  return (
    <Text as="span" numeric size="caption" tone="muted">
      {value}
    </Text>
  );
}

function CollectionItems({ collection }: { collection: LibraryCollection }) {
  const [first] = collection.files;
  if (!first) {
    return null;
  }
  if (collection.relativePath === "") {
    return collection.files.map((file) => (
      <FileItem file={file} key={file.id} />
    ));
  }
  if (collection.files.length === 1) {
    return <FileItem context={collection.relativePath} file={first} />;
  }
  return (
    <TreeItem label={collection.relativePath} value={collection.id}>
      <TreeItemTrigger title={collection.path}>
        <TreeItemIndicator />
        <TreeItemLabel>{collection.relativePath}</TreeItemLabel>
        <Count value={collection.files.length} />
      </TreeItemTrigger>
      <TreeItemContent>
        {collection.files.map((file) => (
          <FileItem file={file} key={file.id} />
        ))}
      </TreeItemContent>
    </TreeItem>
  );
}

function ScopeItem({
  scope,
  favorite,
}: {
  scope: LibraryScope;
  favorite: boolean;
}) {
  return (
    <TreeItem label={scope.label} value={scope.id}>
      <TreeItemTrigger title={scope.path}>
        <TreeItemIndicator />
        <TreeItemLabel>
          <Text as="span" weight="medium">
            {scope.label}
          </Text>
        </TreeItemLabel>
        {favorite ? (
          <Star
            aria-label="Favorite project"
            className="size-3 shrink-0 fill-current text-muted-foreground"
            role="img"
          />
        ) : null}
        <Count value={scope.files.length} />
      </TreeItemTrigger>
      <TreeItemContent>
        {scope.collections.map((collection) => (
          <CollectionItems collection={collection} key={collection.id} />
        ))}
      </TreeItemContent>
    </TreeItem>
  );
}

function FolderNode({ index, nodeId }: { index: TreeIndex; nodeId: string }) {
  const node = index[nodeId];
  if (!node) {
    return null;
  }
  if (node.file) {
    return <FileItem file={node.file} />;
  }
  return (
    <TreeItem label={node.name} value={node.id}>
      <TreeItemTrigger>
        <TreeItemIndicator />
        <TreeItemLabel>{node.name}</TreeItemLabel>
      </TreeItemTrigger>
      <TreeItemContent>
        {node.childIds.map((childId) => (
          <FolderNode index={index} key={childId} nodeId={childId} />
        ))}
      </TreeItemContent>
    </TreeItem>
  );
}

/** Long enough for a collapsed branch to finish opening. */
const REVEAL_DELAY_MS = 250;

export function LibraryTree({
  files,
  roots,
  mode,
  selectedFileId,
  favoritePaths,
  expandAll,
  onSelectFile,
}: LibraryTreeProps) {
  const model = useMemo(
    () => buildLibraryModel(files, roots, favoritePaths),
    [files, roots, favoritePaths]
  );
  const folders = useMemo(
    () => (mode === "folders" ? buildTree(files, roots) : null),
    [files, roots, mode]
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const branchIds = useMemo(() => {
    if (folders) {
      return Object.values(folders)
        .filter((node) => node.isFolder && node.id !== TREE_ROOT_ID)
        .map((node) => node.id);
    }
    return model.scopes.flatMap((scope) => [
      scope.id,
      ...scope.collections.map((collection) => collection.id),
    ]);
  }, [folders, model]);

  // Selecting a file (from search, a link, or the command palette) reveals it once;
  // the user stays free to collapse its project afterwards.
  const location =
    selectedFileId === null
      ? undefined
      : model.locationsByFileId.get(selectedFileId);
  const scopeId = location?.scopeId;
  const collectionId = location?.collectionId;
  useEffect(() => {
    if (!(scopeId && collectionId)) {
      return;
    }
    setOverrides((current) =>
      current[scopeId] && current[collectionId]
        ? current
        : { ...current, [scopeId]: true, [collectionId]: true }
    );
  }, [scopeId, collectionId]);

  // Folders start open like a file explorer; projects start closed so a large
  // library opens as a short list, except a lone project, which has no siblings.
  const expanded = useMemo(() => {
    if (expandAll) {
      return branchIds;
    }
    const loneScopeId =
      model.scopes.length === 1 ? model.scopes[0]?.id : undefined;
    return branchIds.filter(
      (id) => overrides[id] ?? (folders !== null || id === loneScopeId)
    );
  }, [branchIds, expandAll, folders, model.scopes, overrides]);

  const filesById = useMemo(
    () => new Map(files.map((file) => [file.id, file])),
    [files]
  );

  // A file opened from elsewhere may sit far down the list: bring its row into
  // view, once the branches above it have finished opening.
  const treeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedFileId === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      treeRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }, REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selectedFileId]);

  return (
    <div ref={treeRef}>
      <Tree
        aria-label="Indexed agent files"
        expandedValue={expanded}
        onExpandedChange={(_, { value, expanded: isExpanded }) => {
          if (!expandAll) {
            setOverrides((current) => ({ ...current, [value]: isExpanded }));
          }
        }}
        onValueChange={([value]) => {
          const fileId = value ? fileIdOf(value) : null;
          const file = fileId === null ? undefined : filesById.get(fileId);
          if (file) {
            onSelectFile(file);
          }
        }}
        selectionMode="single"
        value={selectedFileId === null ? [] : [fileNodeId(selectedFileId)]}
      >
        {folders
          ? folders[TREE_ROOT_ID]?.childIds.map((childId) => (
              <FolderNode index={folders} key={childId} nodeId={childId} />
            ))
          : model.scopes.map((scope) => (
              <ScopeItem
                favorite={favoritePaths.has(scope.path)}
                key={scope.id}
                scope={scope}
              />
            ))}
      </Tree>
    </div>
  );
}
