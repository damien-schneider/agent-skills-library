import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  listDestinationFolders,
  setProjectFavorite,
  toIpcError,
} from "@/lib/ipc";
import type { DestinationFolder } from "@/lib/ipc-types";

export interface UseDestinationFolders {
  folders: DestinationFolder[];
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  remember: (folder: DestinationFolder) => void;
  toggleFavorite: (path: string) => Promise<void>;
}

function replace(folders: DestinationFolder[], updated: DestinationFolder) {
  const known = folders.some((folder) => folder.path === updated.path);
  return known
    ? folders.map((folder) => (folder.path === updated.path ? updated : folder))
    : [...folders, updated];
}

function starring(path: string, favorite: boolean) {
  return (folders: DestinationFolder[]) =>
    folders.map((folder) =>
      folder.path === path ? { ...folder, favorite } : folder
    );
}

/**
 * A folder picked with the system dialog belongs to no list yet — it is neither
 * starred, used, nor indexed — so it is kept aside until a save or a star makes
 * the catalog aware of it.
 */
export function useDestinationFolders(): UseDestinationFolders {
  const [catalog, setCatalog] = useState<DestinationFolder[]>([]);
  const [picked, setPicked] = useState<DestinationFolder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const folders = useMemo(
    () => picked.reduce(replace, catalog),
    [catalog, picked]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listDestinationFolders();
      setCatalog(next);
      setPicked((current) =>
        current.filter(
          (folder) => !next.some((known) => known.path === folder.path)
        )
      );
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remember = useCallback((folder: DestinationFolder) => {
    setPicked((current) => replace(current, folder));
  }, []);

  const toggleFavorite = useCallback(
    async (path: string) => {
      const favorite = !folders.find((folder) => folder.path === path)
        ?.favorite;
      setCatalog(starring(path, favorite));
      setPicked(starring(path, favorite));
      try {
        await setProjectFavorite(path, favorite);
      } catch (cause) {
        setCatalog(starring(path, !favorite));
        setPicked(starring(path, !favorite));
        toast.error(toIpcError(cause).message);
      }
    },
    [folders]
  );

  return { error, folders, loading, refresh, remember, toggleFavorite };
}
