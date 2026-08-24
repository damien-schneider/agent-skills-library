import {
  Copy,
  FolderTree,
  History,
  RefreshCw,
  Settings,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DuplicatesView } from "./features/duplicates/duplicates-view";
import { LibraryView } from "./features/library/library-view";
import { useLibraryFile } from "./features/library/use-library-file";
import { PromptHistoryView } from "./features/prompts/prompt-history-view";
import { RegistryPane } from "./features/registry/registry-pane";
import { useScan } from "./features/scan/use-scan";
import { RootsSettings } from "./features/settings/roots-settings";
import { GroupsView } from "./features/sync/groups-view";
import { UpdateBanner } from "./features/updates/update-banner";
import { useAppUpdate } from "./features/updates/use-app-update";
import { cn } from "./lib/utils";
import { Toaster } from "./shared/components/ui/sonner";
import { useAppReloadShortcut } from "./use-app-reload-shortcut";

export type ViewId =
  | "library"
  | "prompts"
  | "duplicates"
  | "sync"
  | "registry"
  | "settings";

const PRIMARY_RAIL_ITEMS: {
  id: Exclude<ViewId, "settings">;
  label: string;
  icon: typeof FolderTree;
}[] = [
  { id: "library", label: "Library", icon: FolderTree },
  { id: "prompts", label: "Prompts", icon: History },
  { id: "duplicates", label: "Duplicates", icon: Copy },
  { id: "sync", label: "Sync", icon: RefreshCw },
  { id: "registry", label: "Registry", icon: Store },
];

const SETTINGS_RAIL_ITEM = {
  id: "settings",
  label: "Settings",
  icon: Settings,
} satisfies { id: ViewId; label: string; icon: typeof FolderTree };

const ACTIVE_VIEW_STORAGE_KEY = "another-dev-tool.active-view";

function isViewId(value: string | null): value is ViewId {
  return (
    value === "library" ||
    value === "prompts" ||
    value === "duplicates" ||
    value === "sync" ||
    value === "registry" ||
    value === "settings"
  );
}

function readStoredView(): ViewId {
  const storedView = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  return isViewId(storedView) ? storedView : "library";
}

export function App() {
  useAppReloadShortcut();
  const [view, setView] = useState<ViewId>(readStoredView);
  const [mountedViews, setMountedViews] = useState<Set<ViewId>>(
    () => new Set([view])
  );
  const library = useLibraryFile();
  const scan = useScan();
  const update = useAppUpdate();

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, view);
  }, [view]);

  const selectView = useCallback((nextView: ViewId) => {
    setMountedViews((current) => {
      if (current.has(nextView)) {
        return current;
      }
      const nextMountedViews = new Set(current);
      nextMountedViews.add(nextView);
      return nextMountedViews;
    });
    setView(nextView);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <UpdateBanner {...update} />

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Main navigation"
          className="flex w-16 shrink-0 flex-col items-center border-border border-r bg-sidebar py-3"
        >
          <div className="flex flex-col gap-1">
            {PRIMARY_RAIL_ITEMS.map((item) => (
              <RailItem
                active={view === item.id}
                item={item}
                key={item.id}
                onSelect={selectView}
                unsaved={item.id === "library" && library.editor.dirty}
              />
            ))}
          </div>
          <div className="mt-auto border-sidebar-border border-t pt-2">
            <RailItem
              active={view === SETTINGS_RAIL_ITEM.id}
              item={SETTINGS_RAIL_ITEM}
              onSelect={selectView}
            />
          </div>
        </nav>

        <main className="min-h-0 min-w-0 flex-1">
          {mountedViews.has("library") ? (
            <div className="h-full" hidden={view !== "library"}>
              <LibraryView
                library={library}
                onOpenSettings={() => selectView("settings")}
                scan={scan}
              />
            </div>
          ) : null}
          {mountedViews.has("prompts") ? (
            <div className="h-full" hidden={view !== "prompts"}>
              <PromptHistoryView />
            </div>
          ) : null}
          {mountedViews.has("duplicates") ? (
            <div className="h-full" hidden={view !== "duplicates"}>
              <DuplicatesView onGroupCreated={() => selectView("sync")} />
            </div>
          ) : null}
          {mountedViews.has("sync") ? (
            <div className="h-full" hidden={view !== "sync"}>
              <GroupsView />
            </div>
          ) : null}
          {mountedViews.has("registry") ? (
            <div className="h-full" hidden={view !== "registry"}>
              <RegistryPane />
            </div>
          ) : null}
          {mountedViews.has("settings") ? (
            <div className="h-full" hidden={view !== "settings"}>
              <RootsSettings scan={scan} />
            </div>
          ) : null}
        </main>
      </div>

      <Toaster />
    </div>
  );
}

function RailItem({
  active,
  item,
  onSelect,
  unsaved,
}: {
  active: boolean;
  item: { id: ViewId; label: string; icon: typeof FolderTree };
  onSelect: (view: ViewId) => void;
  unsaved?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={`${item.label}${unsaved ? ", unsaved changes" : ""}`}
      className={cn(
        "relative flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
      onClick={() => onSelect(item.id)}
      title={item.label}
      type="button"
    >
      <Icon className="size-4" />
      <span className="text-[10px] leading-none">{item.label}</span>
      {unsaved ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-amber-500"
        />
      ) : null}
    </button>
  );
}
