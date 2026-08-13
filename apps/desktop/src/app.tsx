import {
  Copy,
  FolderTree,
  History,
  RefreshCw,
  Settings,
  Store,
} from "lucide-react";
import { useState } from "react";

import { DuplicatesView } from "./features/duplicates/duplicates-view";
import { LibraryView } from "./features/library/library-view";
import { PromptHistoryView } from "./features/prompts/prompt-history-view";
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

export function App() {
  const [view, setView] = useState<ViewId>("library");
  const scan = useScan();
  const update = useAppUpdate();

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
                onSelect={setView}
              />
            ))}
          </div>
          <div className="mt-auto border-sidebar-border border-t pt-2">
            <RailItem
              active={view === SETTINGS_RAIL_ITEM.id}
              item={SETTINGS_RAIL_ITEM}
              onSelect={setView}
            />
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          {view === "library" ? <LibraryView scan={scan} /> : null}
          {view === "prompts" ? <PromptHistoryView /> : null}
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

function RailItem({
  active,
  item,
  onSelect,
}: {
  active: boolean;
  item: { id: ViewId; label: string; icon: typeof FolderTree };
  onSelect: (view: ViewId) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none",
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
    </button>
  );
}
