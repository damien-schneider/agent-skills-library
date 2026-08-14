import { List, Search, SquareStack, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFavoriteProjects } from "@/features/projects/use-favorite-projects";
import { ScanStatus } from "@/features/scan/scan-status";
import type { UseScan } from "@/features/scan/use-scan";
import { onIndexUpdated } from "@/lib/events";
import { listFiles, listRoots, toIpcError } from "@/lib/ipc";
import type { FileRow, Root } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

import { EditorPane } from "./editor-pane";
import { FileList } from "./file-list";
import { FileTree } from "./file-tree";
import type { UseFileContent } from "./use-file-content";

type LibraryViewMode = "simplified" | "tree";

const VIEW_MODES: {
  id: LibraryViewMode;
  label: string;
  icon: typeof SquareStack;
}[] = [
  { id: "simplified", label: "Simplified", icon: List },
  { id: "tree", label: "Tree", icon: SquareStack },
];

function LibraryFiles({
  error,
  files,
  indexedFileCount,
  roots,
  selectedFileId,
  viewMode,
  expandAll,
  onOpenSettings,
  onRetry,
  onSelectFile,
}: {
  error: string | null;
  files: FileRow[];
  indexedFileCount: number;
  roots: Root[];
  selectedFileId: number | null;
  viewMode: LibraryViewMode;
  expandAll: boolean;
  onOpenSettings: () => void;
  onRetry: () => Promise<void>;
  onSelectFile: (file: FileRow) => void;
}) {
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-6">
        <p className="text-destructive text-sm">{error}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  if (files.length === 0) {
    if (indexedFileCount === 0) {
      return (
        <div className="flex flex-col items-start gap-3 px-4 py-6">
          <p className="text-muted-foreground text-sm">
            Nothing indexed yet. Add a root to begin.
          </p>
          <Button onClick={onOpenSettings} size="sm" variant="outline">
            Open settings
          </Button>
        </div>
      );
    }
    return (
      <p className="px-4 py-6 text-muted-foreground text-sm">
        No files match this filter.
      </p>
    );
  }

  return viewMode === "simplified" ? (
    <FileList
      expandAll={expandAll}
      files={files}
      onSelectFile={onSelectFile}
      roots={roots}
      selectedFileId={selectedFileId}
    />
  ) : (
    <FileTree
      files={files}
      onSelectFile={onSelectFile}
      roots={roots}
      selectedFileId={selectedFileId}
    />
  );
}

export function LibraryView({
  editor,
  onOpenSettings,
  onSelectedFileIdChange,
  scan,
  selectedFileId,
}: {
  editor: UseFileContent;
  onOpenSettings: () => void;
  onSelectedFileIdChange: (fileId: number | null) => void;
  scan: UseScan;
  selectedFileId: number | null;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [roots, setRoots] = useState<Root[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("simplified");
  const [selectedFile, setSelectedFile] = useState<FileRow | null>(null);
  const [pendingFile, setPendingFile] = useState<FileRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const favoriteProjects = useFavoriteProjects();

  const refresh = useCallback(async () => {
    try {
      const [nextFiles, nextRoots] = await Promise.all([
        listFiles(),
        listRoots(),
      ]);
      setFiles(nextFiles);
      setRoots(nextRoots);
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = onIndexUpdated(() => {
      refresh();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle.length === 0
      ? files
      : files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [files, search]);

  const indexedSelection =
    files.find((file) => file.id === selectedFileId) ?? null;
  const selected =
    indexedSelection ??
    (selectedFile?.id === selectedFileId ? selectedFile : null);

  const handleSelectFile = useCallback(
    (file: FileRow) => {
      if (file.id === selectedFileId) {
        return;
      }
      if (editor.dirty) {
        setPendingFile(file);
        return;
      }
      setSelectedFile(file);
      onSelectedFileIdChange(file.id);
    },
    [editor.dirty, onSelectedFileIdChange, selectedFileId]
  );

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-80 shrink-0 flex-col border-border border-r">
        <div className="border-border border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
            <Input
              aria-label="Filter files by path"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search.length > 0) {
                  event.preventDefault();
                  setSearch("");
                }
              }}
              placeholder="Filter by path"
              value={search}
            />
            {search.length > 0 ? (
              <button
                aria-label="Clear file filter"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                onClick={() => setSearch("")}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <fieldset className="mt-1 flex items-center rounded-lg bg-muted p-0.5">
            <legend className="sr-only">Library view</legend>
            {VIEW_MODES.map(({ id, label, icon: Icon }) => (
              <button
                aria-pressed={viewMode === id}
                className={
                  viewMode === id
                    ? "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-background px-2 font-medium text-xs shadow-sm"
                    : "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground text-xs transition-colors hover:text-foreground motion-reduce:transition-none"
                }
                key={id}
                onClick={() => setViewMode(id)}
                type="button"
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        <div className="min-h-0 flex-1">
          <LibraryFiles
            error={error}
            expandAll={search.trim().length > 0}
            files={visible}
            indexedFileCount={files.length}
            onOpenSettings={onOpenSettings}
            onRetry={refresh}
            onSelectFile={handleSelectFile}
            roots={roots}
            selectedFileId={selectedFileId}
            viewMode={viewMode}
          />
        </div>
        <div className="flex items-center justify-between border-border border-t px-3 py-2">
          <span className="text-muted-foreground text-xs">
            {visible.length} files
          </span>
          <ScanStatus scan={scan} />
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <EditorPane
          editor={editor}
          favorite={
            selected?.projectDir
              ? favoriteProjects.favoritePaths.has(selected.projectDir)
              : false
          }
          file={selected}
          onToggleFavorite={favoriteProjects.toggle}
        />
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingFile(null);
          }
        }}
        open={pendingFile !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              Keep editing the current file, or discard those changes before
              opening {pendingFile?.relPath}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingFile(null)} variant="outline">
              Keep editing
            </Button>
            <Button
              onClick={() => {
                if (pendingFile) {
                  setSelectedFile(pendingFile);
                  onSelectedFileIdChange(pendingFile.id);
                  setPendingFile(null);
                }
              }}
              variant="destructive"
            >
              Discard &amp; open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
