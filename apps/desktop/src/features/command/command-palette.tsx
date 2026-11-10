import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemContent,
  CommandItemDescription,
  CommandItemTitle,
  CommandList,
  CommandShortcut,
} from "@ctrl-ui/react/ui/command";
import { type LucideIcon, Plus, RefreshCw, Settings } from "lucide-react";
import { useMemo, useState } from "react";

import { PRIMARY_VIEWS, type ViewId } from "@/app-views";
import { displayPath } from "@/features/destinations/destination-path";
import { FileKindIcon } from "@/features/library/file-kind";
import { fileTitle, filterFiles } from "@/features/library/library-model";
import { useHomeDirectory } from "@/lib/home-dir";
import type { FileRow } from "@/lib/ipc-types";

/** Enough to fill the list several times over; past that the query needs narrowing, not scrolling. */
const MAX_FILE_RESULTS = 40;

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  run: () => void;
}

/** Name matches outrank path and description matches, and prefixes outrank the rest. */
function rankFiles(files: readonly FileRow[], query: string): FileRow[] {
  const needle = query.trim().toLowerCase();
  const score = (file: FileRow) => {
    const title = fileTitle(file).toLowerCase();
    if (title.startsWith(needle)) {
      return 0;
    }
    return title.includes(needle) ? 1 : 2;
  };
  return filterFiles(files, query)
    .sort(
      (left, right) =>
        score(left) - score(right) ||
        fileTitle(left).localeCompare(fileTitle(right))
    )
    .slice(0, MAX_FILE_RESULTS);
}

export function CommandPalette({
  open,
  onOpenChange,
  files,
  onOpenFile,
  onSelectView,
  onNewSkill,
  onRescan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: readonly FileRow[];
  onOpenFile: (file: FileRow) => void;
  onSelectView: (view: ViewId) => void;
  onNewSkill: () => void;
  onRescan: () => void;
}) {
  const [query, setQuery] = useState("");
  const home = useHomeDirectory();
  const searching = query.trim().length > 0;

  const matches = useMemo(
    () => (searching ? rankFiles(files, query) : []),
    [files, query, searching]
  );

  const actions: PaletteAction[] = [
    {
      id: "new-skill",
      label: "New skill",
      icon: Plus,
      shortcut: "⌘N",
      run: onNewSkill,
    },
    ...PRIMARY_VIEWS.map(({ id, label, icon }) => ({
      id: `view-${id}`,
      label: `Go to ${label}`,
      icon,
      run: () => onSelectView(id),
    })),
    {
      id: "view-settings",
      label: "Go to Settings",
      icon: Settings,
      run: () => onSelectView("settings"),
    },
    { id: "rescan", label: "Rescan folders", icon: RefreshCw, run: onRescan },
  ];
  const needle = query.trim().toLowerCase();
  const visibleActions = actions.filter((action) =>
    action.label.toLowerCase().includes(needle)
  );

  const close = (run: () => void) => {
    onOpenChange(false);
    setQuery("");
    run();
  };

  return (
    <CommandDialog
      commandProps={{ shouldFilter: false }}
      description="Search skills, agents, and rules, or run a command."
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
        }
      }}
      open={open}
      title="Search"
    >
      <CommandInput
        onValueChange={setQuery}
        placeholder="Search skills, agents, rules…"
        value={query}
      />
      <CommandList>
        <CommandEmpty title={`No match for “${query.trim()}”`} />
        {matches.length > 0 ? (
          <CommandGroup heading="Library">
            {matches.map((file) => (
              <CommandItem
                key={file.id}
                onSelect={() => close(() => onOpenFile(file))}
                value={`file-${file.id}`}
              >
                <FileKindIcon kind={file.kind} />
                <CommandItemContent>
                  <CommandItemTitle>{fileTitle(file)}</CommandItemTitle>
                  <CommandItemDescription>
                    {file.description ?? displayPath(file.path, home)}
                  </CommandItemDescription>
                </CommandItemContent>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {visibleActions.length > 0 ? (
          <CommandGroup heading="Commands">
            {visibleActions.map(({ id, label, icon: Icon, shortcut, run }) => (
              <CommandItem key={id} onSelect={() => close(run)} value={id}>
                <Icon />
                {label}
                {shortcut ? (
                  <CommandShortcut>{shortcut}</CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
