import { useCallback, useEffect, useRef, useState } from "react";

import { onIndexUpdated } from "@/lib/events";
import { listFiles, listRoots, toIpcError } from "@/lib/ipc";
import type { FileRow, Root } from "@/lib/ipc-types";

export interface LibraryIndex {
  files: FileRow[];
  roots: Root[];
  /** False until the first load settles, so empty states never flash on launch. */
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Everything the index knows, kept current as scans and the watcher report changes. */
export function useLibraryIndex(): LibraryIndex {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [roots, setRoots] = useState<Root[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    try {
      const [nextFiles, nextRoots] = await Promise.all([
        listFiles(),
        listRoots(),
      ]);
      if (request !== latestRequest.current) {
        return;
      }
      setFiles(nextFiles);
      setRoots(nextRoots);
      setError(null);
    } catch (cause) {
      if (request === latestRequest.current) {
        setError(toIpcError(cause).message);
      }
    } finally {
      if (request === latestRequest.current) {
        setReady(true);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = onIndexUpdated(() => {
      refresh();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [refresh]);

  return { files, roots, ready, error, refresh };
}
