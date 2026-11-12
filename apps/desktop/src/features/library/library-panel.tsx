import { Button } from "@ctrl-ui/react/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@ctrl-ui/react/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@ctrl-ui/react/ui/empty";
import { Input } from "@ctrl-ui/react/ui/input";
import { InputGroup, InputGroupAddon } from "@ctrl-ui/react/ui/input-group";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@ctrl-ui/react/ui/sidebar";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Heading, Text } from "@ctrl-ui/react/ui/typography";
import { ListFilter, Plus, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { UseScan } from "@/features/scan/use-scan";
import type { FileRow } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";

import { filterFiles } from "./library-model";
import { LibraryTree, type LibraryTreeMode } from "./library-tree";
import type { LibraryIndex } from "./use-library-index";

const MODE_STORAGE_KEY = "another-dev-tool.library-mode";

function readStoredMode(): LibraryTreeMode {
  return window.localStorage.getItem(MODE_STORAGE_KEY) === "folders"
    ? "folders"
    : "grouped";
}

export interface LibraryPanelProps {
  index: LibraryIndex;
  scan: UseScan;
  selectedFileId: number | null;
  favoritePaths: ReadonlySet<string>;
  onSelectFile: (file: FileRow) => void;
  onNewSkill: () => void;
  onOpenSettings: () => void;
}

function PanelMessage({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onAction: () => void };
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? (
        <EmptyContent>
          <Button onClick={action.onAction} size="sm" variant="surface">
            {action.label}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

function ScanFooter({
  scan,
  shown,
  total,
}: {
  scan: UseScan;
  shown: number;
  total: number;
}) {
  if (scan.running) {
    return (
      <>
        <Spinner label="Scanning folders" size="xs" />
        <Text className="min-w-0 flex-1 truncate" size="caption" tone="muted">
          {scan.stats ? `Scanning… ${scan.stats.seen} found` : "Scanning…"}
        </Text>
        <Button onClick={scan.cancel} size="xs" variant="ghost">
          Stop
        </Button>
      </>
    );
  }
  return (
    <>
      <Text
        className="min-w-0 flex-1 truncate"
        numeric
        size="caption"
        title={scan.error ?? undefined}
        tone={scan.error ? "destructive" : "muted"}
      >
        {scan.error ??
          (shown === total
            ? `${total} ${total === 1 ? "file" : "files"}`
            : `${shown} of ${total}`)}
      </Text>
      <IconButton label="Rescan folders" onClick={() => scan.start()} size="xs">
        <RefreshCw />
      </IconButton>
    </>
  );
}

export function LibraryPanel({
  index,
  scan,
  selectedFileId,
  favoritePaths,
  onSelectFile,
  onNewSkill,
  onOpenSettings,
}: LibraryPanelProps) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<LibraryTreeMode>(readStoredMode);
  const visible = useMemo(
    () => filterFiles(index.files, search),
    [index.files, search]
  );
  const searching = search.trim().length > 0;

  let body = (
    <LibraryTree
      expandAll={searching}
      favoritePaths={favoritePaths}
      files={visible}
      mode={mode}
      onSelectFile={onSelectFile}
      roots={index.roots}
      selectedFileId={selectedFileId}
    />
  );
  if (index.error) {
    body = (
      <PanelMessage
        action={{ label: "Try again", onAction: index.refresh }}
        description={index.error}
        title="The library could not be loaded"
      />
    );
  } else if (!index.ready) {
    body = <span />;
  } else if (index.files.length === 0) {
    body = scan.running ? (
      <PanelMessage
        description="Skills, agents, and rules appear here as they are found."
        title="Looking through your folders…"
      />
    ) : (
      <PanelMessage
        action={
          index.roots.length === 0
            ? { label: "Choose folders", onAction: onOpenSettings }
            : { label: "New skill", onAction: onNewSkill }
        }
        description={
          index.roots.length === 0
            ? "Pick the folders that hold your projects and agent configuration."
            : "None of your folders contain skills, agents, or rules yet."
        }
        title="Nothing here yet"
      />
    );
  } else if (visible.length === 0) {
    body = (
      <PanelMessage
        action={{ label: "Clear search", onAction: () => setSearch("") }}
        title={`No match for “${search.trim()}”`}
      />
    );
  }

  return (
    <>
      <SidebarHeader>
        <div
          className="flex h-(--sidebar-strip-height) items-center gap-1 ps-4"
          data-tauri-drag-region="deep"
        >
          <Heading className="min-w-0 flex-1" level={2} size="label">
            Library
          </Heading>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="List options"
              iconOnly
              size="sm"
              variant="ghost"
            >
              <ListFilter />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                onValueChange={(next: LibraryTreeMode) => {
                  setMode(next);
                  window.localStorage.setItem(MODE_STORAGE_KEY, next);
                }}
                value={mode}
              >
                {/* Base UI requires group labels inside their group. */}
                <DropdownMenuLabel>Arrange by</DropdownMenuLabel>
                <DropdownMenuRadioItem value="grouped">
                  Project
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="folders">
                  Folder
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton label="New skill" onClick={onNewSkill} shortcut="⌘N">
            <Plus />
          </IconButton>
        </div>
        <InputGroup size="sm">
          <InputGroupAddon>
            <Search aria-hidden="true" className="size-3.5" />
          </InputGroupAddon>
          <Input
            aria-label="Search the library"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search.length > 0) {
                event.preventDefault();
                setSearch("");
              }
            }}
            placeholder="Search"
            value={search}
          />
          {search.length > 0 ? (
            <InputGroupAddon>
              <Button
                aria-label="Clear search"
                iconOnly
                onClick={() => setSearch("")}
                size="xs"
                variant="ghost"
              >
                <X />
              </Button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </SidebarHeader>
      <SidebarContent>{body}</SidebarContent>
      <SidebarFooter>
        <div className="flex min-h-7 items-center gap-2 ps-2">
          <ScanFooter
            scan={scan}
            shown={visible.length}
            total={index.files.length}
          />
        </div>
      </SidebarFooter>
    </>
  );
}
