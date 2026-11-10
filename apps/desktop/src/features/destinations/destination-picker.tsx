import { Button } from "@ctrl-ui/react/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@ctrl-ui/react/ui/command";
import { Kbd } from "@ctrl-ui/react/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ctrl-ui/react/ui/popover";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import {
  Ban,
  ChevronsUpDown,
  CornerDownLeft,
  Folder,
  FolderOpen,
  Star,
} from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useHomeDirectory } from "@/lib/home-dir";
import { resolveDestinationFolder, toIpcError } from "@/lib/ipc";
import type { DestinationFolder } from "@/lib/ipc-types";
import {
  destinationSections,
  displayPath,
  folderName,
  looksLikePath,
} from "./destination-path";
import { FolderRow, PickerRow } from "./destination-rows";
import { useDestinationFolders } from "./use-destination-folders";

const NO_DESTINATION_VALUE = "__none__";
const TYPED_PATH_VALUE = "__typed__";
const STAR_SHORTCUT_KEY = "d";
const STAR_SHORTCUT_LABEL = navigator.platform.includes("Mac")
  ? "⌘D"
  : "Ctrl+D";

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
  const [highlighted, setHighlighted] = useState("");
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
      setHighlighted("");
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

  // The star sits inside an option, out of the tab order: the keyboard reaches
  // it through the row that is highlighted.
  const starHighlighted = (event: KeyboardEvent<HTMLDivElement>) => {
    const starring =
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === STAR_SHORTCUT_KEY;
    if (!starring) {
      return;
    }
    const folder = sections
      .flatMap((section) => section.folders)
      .find((candidate) => candidate.path === highlighted);
    if (folder) {
      event.preventDefault();
      destinations.toggleFavorite(folder.path);
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={
              value
                ? `Destination folder: ${value}`
                : "Choose a destination folder"
            }
            disabled={disabled}
            size="sm"
            title={value ?? undefined}
            variant={value ? "surface" : "ghost"}
          />
        }
      >
        <Folder />
        <span className="max-w-44 truncate">
          {value ? folderName(value) : "Destination"}
        </span>
        {selected?.favorite ? <Star className="fill-current" /> : null}
        <ChevronsUpDown />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-120 max-w-(--available-width)"
        padding="none"
      >
        <Command
          chrome="embedded"
          label="Destination folder"
          onKeyDown={starHighlighted}
          onValueChange={setHighlighted}
          shouldFilter={false}
          value={highlighted}
        >
          <CommandInput
            onValueChange={setQuery}
            placeholder="Search folders, or paste a path"
            value={query}
          />
          <CommandList>
            {value === null ? null : (
              <PickerRow
                icon={<Ban aria-hidden="true" />}
                onSelect={() => choose(null)}
                value={NO_DESTINATION_VALUE}
              >
                No destination
              </PickerRow>
            )}

            {unlistedTyped ? (
              <PickerRow
                icon={<CornerDownLeft aria-hidden="true" />}
                onSelect={() => adopt(unlistedTyped)}
                value={TYPED_PATH_VALUE}
              >
                Use {displayPath(unlistedTyped.path, home)}
              </PickerRow>
            ) : null}

            {sections.map((section) => (
              <CommandGroup heading={section.label} key={section.id}>
                {section.folders.map((folder) => (
                  <FolderRow
                    folder={folder}
                    highlighted={folder.path === highlighted}
                    home={home}
                    key={folder.path}
                    onSelect={choose}
                    onToggleFavorite={destinations.toggleFavorite}
                    selected={folder.path === value}
                  />
                ))}
                {section.hidden > 0 ? (
                  <PickerNote>
                    {section.hidden} more. Type to narrow the list.
                  </PickerNote>
                ) : null}
              </CommandGroup>
            ))}

            {typed.status === "missing" ? (
              <PickerNote>No folder at {typed.path}</PickerNote>
            ) : null}

            <PickerStatus
              empty={sections.length === 0 && typed.status === "none"}
              error={destinations.error}
              loading={destinations.loading}
              onRetry={destinations.refresh}
              query={query}
            />
          </CommandList>

          <div className="flex items-center justify-between gap-3 border-border border-t p-1">
            <Button onClick={browse} size="sm" variant="ghost">
              <FolderOpen />
              Browse…
            </Button>
            {sections.length > 0 ? (
              <Text
                as="span"
                className="flex items-center gap-1.5 pe-2"
                size="caption"
                tone="muted"
              >
                <Kbd>{STAR_SHORTCUT_LABEL}</Kbd>
                Star
              </Text>
            ) : null}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
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

function PickerNote({ children }: { children: ReactNode }) {
  return (
    <Text as="p" className="px-2 py-1.5" size="label" tone="muted">
      {children}
    </Text>
  );
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
      <div
        className="flex items-center justify-between gap-3 px-2 py-1.5"
        role="alert"
      >
        <Text size="label" tone="destructive">
          {error}
        </Text>
        <Button onClick={onRetry} size="xs" variant="surface">
          Try again
        </Button>
      </div>
    );
  }
  if (!empty) {
    return null;
  }
  if (loading) {
    return <PickerNote>Loading folders…</PickerNote>;
  }
  return (
    <PickerNote>
      {query.trim().length > 0
        ? "No folder matches. Paste a full path, or browse."
        : "No folder yet. Browse to pick one, and star it to keep it here."}
    </PickerNote>
  );
}
