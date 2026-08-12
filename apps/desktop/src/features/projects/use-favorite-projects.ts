import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  listFavoriteProjects,
  setProjectFavorite,
  toIpcError,
} from "@/lib/ipc";
import type { FavoriteProject } from "@/lib/ipc-types";

export interface UseFavoriteProjects {
  favorites: FavoriteProject[];
  favoritePaths: ReadonlySet<string>;
  loading: boolean;
  toggle: (path: string) => Promise<void>;
}

export function useFavoriteProjects(): UseFavoriteProjects {
  const [favorites, setFavorites] = useState<FavoriteProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await listFavoriteProjects();
        if (active) {
          setFavorites(stored);
        }
      } catch (cause) {
        toast.error(toIpcError(cause).message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const favoritePaths = useMemo(
    () => new Set(favorites.map((favorite) => favorite.path)),
    [favorites]
  );

  const toggle = useCallback(
    async (path: string) => {
      const favorite = !favoritePaths.has(path);
      try {
        await setProjectFavorite(path, favorite);
        setFavorites((current) =>
          favorite
            ? [{ path, createdAt: Date.now() }, ...current]
            : current.filter((project) => project.path !== path)
        );
      } catch (cause) {
        toast.error(toIpcError(cause).message);
      }
    },
    [favoritePaths]
  );

  return { favorites, favoritePaths, loading, toggle };
}
