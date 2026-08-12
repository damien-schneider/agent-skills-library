import { List, Search, SquareStack } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFavoriteProjects } from "@/features/projects/use-favorite-projects";
import { ScanStatus } from "@/features/scan/scan-status";
import type { UseScan } from "@/features/scan/use-scan";
import { onIndexUpdated } from "@/lib/events";
import { listFiles, listRoots, toIpcError } from "@/lib/ipc";
import type { FileRow, Root } from "@/lib/ipc-types";
import { Input } from "@/shared/components/ui/input";

import { EditorPane } from "./editor-pane";
import { FileList } from "./file-list";
import { FileTree } from "./file-tree";

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
  onSelectFile,
}: {
  error: string | null;
  files: FileRow[];
  indexedFileCount: number;
  roots: Root[];
  selectedFileId: number | null;
  viewMode: LibraryViewMode;
  onSelectFile: (file: FileRow) => void;
}) {
  if (error) {
    return <p className="px-4 py-6 text-destructive text-sm">{error}</p>;
  }

  if (files.length === 0) {
    return (
      <p className="px-4 py-6 text-muted-foreground text-sm">
        {indexedFileCount === 0
          ? "Nothing indexed yet — add a root and run a scan."
          : "No files match this filter."}
      </p>
    );
  }

  return viewMode === "simplified" ? (
    <FileList
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

export function LibraryView({ scan }: { scan: UseScan }) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [roots, setRoots] = useState<Root[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("tree");
  const [selectedId, setSelectedId] = useState<number | null>(null);
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

  const selected = useMemo(
    () => files.find((file) => file.id === selectedId) ?? null,
    [files, selectedId]
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
              placeholder="Filter by path"
              value={search}
            />
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
            files={visible}
            indexedFileCount={files.length}
            onSelectFile={(file) => setSelectedId(file.id)}
            roots={roots}
            selectedFileId={selectedId}
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
          favorite={
            selected?.projectDir
              ? favoriteProjects.favoritePaths.has(selected.projectDir)
              : false
          }
          file={selected}
          onToggleFavorite={favoriteProjects.toggle}
        />
      </section>
    </div>
  );
}
