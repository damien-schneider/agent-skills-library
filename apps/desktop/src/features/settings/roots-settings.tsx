import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ScanStatus } from "@/features/scan/scan-status";
import type { UseScan } from "@/features/scan/use-scan";
import {
  addRoot,
  getWatcherStatus,
  listRoots,
  removeRoot,
  setRootEnabled,
  setWatcherEnabled,
  toIpcError,
} from "@/lib/ipc";
import type { Root, WatcherStatus } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import {
  EmptyState,
  ErrorState,
  ViewHeader,
  ViewLayout,
} from "@/shared/components/view-layout";

export function RootsSettings({ scan }: { scan: UseScan }) {
  const [roots, setRoots] = useState<Root[]>([]);
  const [watcher, setWatcher] = useState<WatcherStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextRoots, nextWatcher] = await Promise.all([
        listRoots(),
        getWatcherStatus(),
      ]);
      setRoots(nextRoots);
      setWatcher(nextWatcher);
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    }
  }, []);

  const handleWatcherToggle = async () => {
    try {
      setWatcher(await setWatcherEnabled(!watcher?.enabled));
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked !== "string") {
      return;
    }
    try {
      const root = await addRoot(picked);
      toast.success(`Added ${root.path}`);
      await refresh();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  const handleToggle = async (root: Root) => {
    try {
      await setRootEnabled(root.id, !root.enabled);
      await refresh();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  const handleRemove = async (root: Root) => {
    try {
      await removeRoot(root.id);
      toast.success(`Removed ${root.path}`);
      await refresh();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  return (
    <ViewLayout>
      <ViewHeader
        actions={
          <Button
            onClick={() => {
              handleAdd();
            }}
            size="sm"
          >
            <FolderPlus />
            Add root
          </Button>
        }
        description="Choose which directories are indexed for agent files."
        title="Settings"
      />

      <Separator />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      <ul className="flex flex-col gap-2">
        {roots.map((root) => (
          <li
            className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
            key={root.id}
          >
            <input
              checked={root.enabled}
              className="size-4 accent-primary"
              id={`root-${root.id}`}
              onChange={() => {
                handleToggle(root);
              }}
              type="checkbox"
            />
            <label
              className="min-w-0 flex-1 truncate text-sm"
              htmlFor={`root-${root.id}`}
            >
              {root.path}
            </label>
            <Button
              aria-label={`Remove ${root.path} from indexed roots`}
              onClick={() => {
                handleRemove(root);
              }}
              size="sm"
              title="Remove root"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
        {roots.length === 0 && !error ? (
          <li>
            <EmptyState
              action={
                <Button onClick={handleAdd} size="sm">
                  <FolderPlus />
                  Add root
                </Button>
              }
              description="Add a directory to begin indexing agent configuration files."
              icon={Settings}
              title="No indexed directories"
            />
          </li>
        ) : null}
      </ul>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-sm">Watch for changes</h2>
          <p className="text-muted-foreground text-xs">
            Re-indexes touched files as they change
            {watcher?.enabled && !watcher.running
              ? " — idle, no enabled root"
              : ""}
            .
          </p>
        </div>
        <input
          aria-label="Watch for changes"
          checked={watcher?.enabled ?? false}
          className="size-4 accent-primary"
          onChange={() => {
            handleWatcherToggle();
          }}
          type="checkbox"
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-sm">Index</h2>
          <p className="text-muted-foreground text-xs">
            Rescans every enabled root; unchanged files are not rehashed.
          </p>
        </div>
        <ScanStatus scan={scan} />
      </div>
    </ViewLayout>
  );
}
