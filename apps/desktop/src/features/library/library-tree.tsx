import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@ctrl-ui/react/ui/sidebar";
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
import { FolderGit2, GitBranch, Link2, Star, UserRound } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  entryTitle,
  type LibraryCollection,
  type LibraryEntry,
  type LibraryScope,
  pathName,
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

const SCOPE_ICONS = {
  personal: UserRound,
  project: FolderGit2,
  worktree: GitBranch,
} as const;

function linkLabel(entry: LibraryEntry): string | null {
  if (entry.linked) {
    return `Linked from ${entry.file.path}`;
  }
  if (entry.file.isSymlink) {
    return "Symbolic link";
  }
  const count = entry.file.aliases.length;
  if (count === 0) {
    return null;
  }
  return `Linked from ${count} other ${count === 1 ? "location" : "locations"}`;
}

function EntryItem({
  entry,
  context,
}: {
  entry: LibraryEntry;
  context?: string;
}) {
  const { file } = entry;
  const title = entryTitle(entry);
  const link = linkLabel(entry);
  return (
    <TreeItem label={title} value={entry.id}>
      <TreeItemTrigger title={entry.path}>
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
        {link ? (
          <Link2 aria-label={link} className={ICON_CLASS} role="img" />
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
  const [first] = collection.entries;
  if (!first) {
    return null;
  }
  if (collection.relativePath === "") {
    return collection.entries.map((entry) => (
      <EntryItem entry={entry} key={entry.id} />
    ));
  }
  if (collection.entries.length === 1) {
    return <EntryItem context={collection.relativePath} entry={first} />;
  }
  return (
    <TreeItem label={collection.relativePath} value={collection.id}>
      <TreeItemTrigger title={collection.path}>
        <TreeItemIndicator />
        <TreeItemLabel>{collection.relativePath}</TreeItemLabel>
        <Count value={collection.entries.length} />
      </TreeItemTrigger>
      <TreeItemContent>
        {collection.entries.map((entry) => (
          <EntryItem entry={entry} key={entry.id} />
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
  const Icon = SCOPE_ICONS[scope.kind];
  return (
    <TreeItem label={scope.label} value={scope.id}>
      <TreeItemTrigger title={scope.path}>
        <TreeItemIndicator />
        <Icon aria-hidden="true" className={ICON_CLASS} />
        <TreeItemLabel className="flex-initial">
          <Text as="span" weight="medium">
            {scope.label}
          </Text>
        </TreeItemLabel>
        <Text
          as="span"
          className="min-w-0 flex-1 truncate"
          size="caption"
          tone="muted"
        >
          {scope.kind === "personal" ? pathName(scope.path) : ""}
        </Text>
        {favorite ? (
          <Star
            aria-label="Favorite project"
            className="size-3 shrink-0 fill-current text-muted-foreground"
            role="img"
          />
        ) : null}
        <Count value={scope.entryCount} />
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
    return (
      <EntryItem
        entry={{
          id: node.id,
          file: node.file,
          path: node.file.path,
          linked: false,
        }}
      />
    );
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
  const personalHeadingId = useId();
  const projectsHeadingId = useId();
  const model = useMemo(
    () => buildLibraryModel(files, roots, favoritePaths),
    [files, roots, favoritePaths]
  );
  const folders = useMemo(
    () => (mode === "folders" ? buildTree(files, roots) : null),
    [files, roots, mode]
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // A file can show twice (in an agent home and in its repository): the row the
  // user picked stays the highlighted one.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const branchIds = useMemo(() => {
    if (folders) {
      return Object.values(folders)
        .filter((node) => node.isFolder && node.id !== TREE_ROOT_ID)
        .map((node) => node.id);
    }
    return [...model.personal, ...model.projects].flatMap((scope) => [
      scope.id,
      ...scope.collections.map((collection) => collection.id),
    ]);
  }, [folders, model]);

  let selectedId: string | null = null;
  if (selectedFileId !== null) {
    selectedId =
      pickedId !== null && fileIdOf(pickedId) === selectedFileId
        ? pickedId
        : fileNodeId(selectedFileId);
  }

  // Selecting a file (from search, a link, or the command palette) reveals it once;
  // the user stays free to collapse its project afterwards.
  const location =
    selectedId === null ? undefined : model.locationsByEntryId.get(selectedId);
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

  // Folders start open like a file explorer; scopes start closed so a large
  // library opens as a short list, except a lone scope, which has no siblings.
  const expanded = useMemo(() => {
    if (expandAll) {
      return branchIds;
    }
    const scopes = [...model.personal, ...model.projects];
    const loneScopeId = scopes.length === 1 ? scopes[0]?.id : undefined;
    return branchIds.filter(
      (id) => overrides[id] ?? (folders !== null || id === loneScopeId)
    );
  }, [branchIds, expandAll, folders, model, overrides]);

  const filesById = useMemo(
    () => new Map(files.map((file) => [file.id, file])),
    [files]
  );

  // A file opened from elsewhere may sit far down the list: bring its row into
  // view, once the branches above it have finished opening.
  const treeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      treeRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }, REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  const treeProps = {
    expandedValue: expanded,
    onExpandedChange: (
      _: string[],
      { value, expanded: isExpanded }: { value: string; expanded: boolean }
    ) => {
      if (!expandAll) {
        setOverrides((current) => ({ ...current, [value]: isExpanded }));
      }
    },
    onValueChange: ([value]: string[]) => {
      const fileId = value ? fileIdOf(value) : null;
      const file = fileId === null ? undefined : filesById.get(fileId);
      if (value && file) {
        setPickedId(value);
        onSelectFile(file);
      }
    },
    selectionMode: "single",
    value: selectedId === null ? [] : [selectedId],
  } as const;

  if (folders) {
    return (
      <div ref={treeRef}>
        <Tree aria-label="Indexed agent files" {...treeProps}>
          {folders[TREE_ROOT_ID]?.childIds.map((childId) => (
            <FolderNode index={folders} key={childId} nodeId={childId} />
          ))}
        </Tree>
      </div>
    );
  }

  return (
    <div ref={treeRef}>
      {model.personal.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel id={personalHeadingId}>
            Personal · every project
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Tree aria-labelledby={personalHeadingId} {...treeProps}>
              {model.personal.map((scope) => (
                <ScopeItem favorite={false} key={scope.id} scope={scope} />
              ))}
            </Tree>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
      {model.projects.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel id={projectsHeadingId}>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <Tree aria-labelledby={projectsHeadingId} {...treeProps}>
              {model.projects.map((scope) => (
                <ScopeItem
                  favorite={favoritePaths.has(scope.path)}
                  key={scope.id}
                  scope={scope}
                />
              ))}
            </Tree>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </div>
  );
}
