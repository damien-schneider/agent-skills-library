import { Copy, FolderTree, RefreshCw, Settings, Store } from "lucide-react";
import { useState } from "react";

import { DuplicatesView } from "./features/duplicates/duplicates-view";
import { LibraryView } from "./features/library/library-view";
import { RegistryPane } from "./features/registry/registry-pane";
import { useScan } from "./features/scan/use-scan";
import { RootsSettings } from "./features/settings/roots-settings";
import { GroupsView } from "./features/sync/groups-view";
import { UpdateBanner } from "./features/updates/update-banner";
import { useAppUpdate } from "./features/updates/use-app-update";
import { cn } from "./lib/utils";
import { Toaster } from "./shared/components/ui/sonner";

export type ViewId =
  | "library"
  | "duplicates"
  | "sync"
  | "registry"
  | "settings";

const RAIL_ITEMS: { id: ViewId; label: string; icon: typeof FolderTree }[] = [
  { id: "library", label: "Library", icon: FolderTree },
  { id: "duplicates", label: "Duplicates", icon: Copy },
  { id: "sync", label: "Sync", icon: RefreshCw },
  { id: "registry", label: "Registry", icon: Store },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const [view, setView] = useState<ViewId>("library");
  const scan = useScan();
  const update = useAppUpdate();

  return (
    <div className="flex h-full flex-col">
      <UpdateBanner {...update} />

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-border border-r bg-sidebar py-3">
          {RAIL_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              className={cn(
                "flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                view === id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60"
              )}
              key={id}
              onClick={() => setView(id)}
              title={label}
              type="button"
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] leading-none">{label}</span>
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          {view === "library" ? <LibraryView scan={scan} /> : null}
          {view === "settings" ? <RootsSettings scan={scan} /> : null}
          {view === "duplicates" ? (
            <DuplicatesView onGroupCreated={() => setView("sync")} />
          ) : null}
          {view === "sync" ? <GroupsView /> : null}
          {view === "registry" ? <RegistryPane /> : null}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
