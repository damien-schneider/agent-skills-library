import { Combobox } from "@base-ui/react/combobox";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import {
  Ban,
  ChevronsUpDown,
  CornerDownLeft,
  Folder,
  FolderOpen,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useHomeDirectory } from "@/lib/home-dir";
import { resolveDestinationFolder, toIpcError } from "@/lib/ipc";
import type { DestinationFolder } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import {
  destinationSections,
  displayPath,
  folderName,
  looksLikePath,
} from "./destination-path";
import { FolderRow, PickerRow } from "./destination-rows";
import { useDestinationFolders } from "./use-destination-folders";

export function DestinationPicker({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (path: string | null) => void;
  value: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const destinations = useDestinationFolders();
  const home = useHomeDirectory();
  const typed = useTypedFolder(query);

  const sections = useMemo(
    () => destinationSections(destinations.folders, query, home),
    [destinations.folders, home, query]
  );
  const selected =
    destinations.folders.find((folder) => folder.path === value) ?? null;
  const unlistedTyped =
    typed.status === "ready" &&
    !destinations.folders.some((folder) => folder.path === typed.folder.path)
      ? typed.folder
      : null;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery("");
      destinations.refresh();
    }
  };

  const choose = (path: string | null) => {
    onChange(path);
    setOpen(false);
  };

  const adopt = (folder: DestinationFolder) => {
    destinations.remember(folder);
    choose(folder.path);
  };

  const browse = async () => {
    setOpen(false);
    try {
      const picked = await openFolderDialog({
        directory: true,
        multiple: false,
        defaultPath: value ?? undefined,
        title: "Choose a destination folder",
      });
      if (typeof picked === "string") {
        adopt(await resolveDestinationFolder(picked));
      }
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  return (
    <Combobox.Root
      autoHighlight
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={handleOpenChange}
      open={open}
    >
      <Combobox.Trigger
        aria-label={
          value ? `Destination folder: ${value}` : "Choose a destination folder"
        }
        disabled={disabled}
        render={<Button size="sm" variant={value ? "secondary" : "ghost"} />}
        title={value ?? undefined}
      >
        <Folder />
        <span className="max-w-44 truncate">
          {value ? folderName(value) : "Destination"}
        </span>
        {selected?.favorite ? <Star className="size-3 fill-current" /> : null}
        <ChevronsUpDown className="opacity-50" data-icon="inline-end" />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          className="z-50"
          side="top"
          sideOffset={8}
        >
          <Combobox.Popup className="flex w-[min(30rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-lg outline-none ring-1 ring-foreground/10">
            <div className="flex items-center gap-2 border-border border-b px-3">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <Combobox.Input
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search folders, or paste a path"
              />
            </div>

            <Combobox.List className="max-h-72 overflow-y-auto p-1.5">
              {value === null ? null : (
                <PickerRow
                  icon={<Ban className="size-4 text-muted-foreground" />}
                  label="No destination"
                  onClick={() => choose(null)}
                  value="__none__"
                />
              )}

              {unlistedTyped ? (
                <PickerRow
                  icon={
                    <CornerDownLeft className="size-4 text-muted-foreground" />
                  }
                  label={`Use ${displayPath(unlistedTyped.path, home)}`}
                  onClick={() => adopt(unlistedTyped)}
                  value="__typed__"
                />
              ) : null}

              {sections.map((section) => (
                <Combobox.Group className="pt-1" key={section.id}>
                  <Combobox.GroupLabel className="px-2 py-1 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-wide">
                    {section.label}
                  </Combobox.GroupLabel>
                  {section.folders.map((folder) => (
                    <FolderRow
                      folder={folder}
                      home={home}
                      key={folder.path}
                      onSelect={choose}
                      onToggleFavorite={destinations.toggleFavorite}
                      selected={folder.path === value}
                    />
                  ))}
                  {section.hidden > 0 ? (
                    <p className="px-2 py-1 text-muted-foreground text-xs">
                      {section.hidden} more — keep typing to narrow it down
                    </p>
                  ) : null}
                </Combobox.Group>
              ))}

              {typed.status === "missing" ? (
                <p className="px-2 py-2 text-muted-foreground text-sm">
                  No folder at {typed.path}
                </p>
              ) : null}

              <PickerStatus
                empty={sections.length === 0 && typed.status === "none"}
                error={destinations.error}
                loading={destinations.loading}
                onRetry={destinations.refresh}
                query={query}
              />
            </Combobox.List>

            <div className="border-border border-t p-1.5">
              <Button
                className="w-full justify-start"
                onClick={browse}
                size="sm"
                variant="ghost"
              >
                <FolderOpen />
                Browse…
              </Button>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

const PATH_PROBE_DELAY_MS = 200;

type TypedFolder =
  | { status: "none" }
  | { status: "checking" }
  | { status: "ready"; folder: DestinationFolder }
  | { status: "missing"; path: string };

/** A pasted path is checked while it is typed, so the row that shows up is one
 * that will actually work. */
function useTypedFolder(query: string): TypedFolder {
  const [typed, setTyped] = useState<TypedFolder>({ status: "none" });
  const path = looksLikePath(query) ? query.trim() : null;

  useEffect(() => {
    if (path === null) {
      setTyped({ status: "none" });
      return;
    }
    setTyped({ status: "checking" });
    let active = true;
    const probe = window.setTimeout(() => {
      resolveDestinationFolder(path)
        .then((folder) => active && setTyped({ status: "ready", folder }))
        .catch(() => active && setTyped({ status: "missing", path }));
    }, PATH_PROBE_DELAY_MS);
    return () => {
      active = false;
      window.clearTimeout(probe);
    };
  }, [path]);

  return typed;
}

function PickerStatus({
  empty,
  error,
  loading,
  onRetry,
  query,
}: {
  empty: boolean;
  error: string | null;
  loading: boolean;
  onRetry: () => Promise<void>;
  query: string;
}) {
  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 px-2 py-3">
        <p className="text-destructive text-xs">{error}</p>
        <Button onClick={onRetry} size="xs" variant="outline">
          Try again
        </Button>
      </div>
    );
  }
  if (!empty) {
    return null;
  }
  if (loading) {
    return (
      <p className="px-2 py-3 text-muted-foreground text-sm">
        Loading folders…
      </p>
    );
  }
  return (
    <p className="px-2 py-3 text-muted-foreground text-sm">
      {query.trim().length > 0
        ? "No folder matches. Paste a full path, or browse."
        : "No folder yet. Browse to pick one, and star it to keep it here."}
    </p>
  );
}
