import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScanStatus } from "@/features/scan/scan-status";
import type { UseScan } from "@/features/scan/use-scan";
import { onIndexUpdated } from "@/lib/events";
import { listFiles, listRoots, toIpcError } from "@/lib/ipc";
import type { FileRow, Root } from "@/lib/ipc-types";
import { Input } from "@/shared/components/ui/input";

import { EditorPane } from "./editor-pane";
import { FileTree } from "./file-tree";

export function LibraryView({ scan }: { scan: UseScan }) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [roots, setRoots] = useState<Root[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="flex items-center gap-2 border-border border-b px-3 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by path"
            value={search}
          />
        </div>
        <div className="min-h-0 flex-1">
          {error ? (
            <p className="px-4 py-6 text-destructive text-sm">{error}</p>
          ) : (
            <FileTree
              files={visible}
              onSelectFile={(file) => setSelectedId(file.id)}
              roots={roots}
              selectedFileId={selectedId}
            />
          )}
        </div>
        <div className="flex items-center justify-between border-border border-t px-3 py-2">
          <span className="text-muted-foreground text-xs">
            {visible.length} files
          </span>
          <ScanStatus scan={scan} />
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <EditorPane file={selected} />
      </section>
    </div>
  );
}
