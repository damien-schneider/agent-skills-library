import { Alert, AlertDescription, AlertTitle } from "@ctrl-ui/react/ui/alert";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ctrl-ui/react/ui/alert-dialog";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@ctrl-ui/react/ui/item";
import { Switch } from "@ctrl-ui/react/ui/switch";
import { Text } from "@ctrl-ui/react/ui/typography";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { CircleAlert, Folder, FolderPlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { useLibraryIndex } from "@/features/library/use-library-index";
import type { UseScan } from "@/features/scan/use-scan";
import { useHomeDirectory } from "@/lib/home-dir";
import { addRoot, removeRoot, setRootEnabled, toIpcError } from "@/lib/ipc";
import type { Root } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/shared/components/view-layout";

import { SettingsSection } from "./settings-section";

const COUNT_FORMAT = new Intl.NumberFormat();

/** Rows sit flush with the section heading and are told apart by a hairline, not a box. */
const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-padding-block": "calc(var(--spacing) * 2.5)",
} as const;

/** The folders to scan next; no `rootIds` means every enabled folder. */
interface QueuedScan {
  rootIds?: number[];
}

const FULL_SCAN: QueuedScan = {};

function folderStatus(root: Root, files: number, scanning: boolean): string {
  if (!root.enabled) {
    return "Not indexed";
  }
  if (files === 0 && scanning) {
    return "Indexing…";
  }
  return `${COUNT_FORMAT.format(files)} ${files === 1 ? "file" : "files"}`;
}

function FolderRow({
  root,
  shown,
  status,
  disabled,
  onToggle,
  onRemove,
}: {
  root: Root;
  shown: string;
  status: string;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <li>
      <Item style={ROW_STYLE}>
        <ItemMedia>
          <Folder aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="max-w-full">
            <Text className="truncate" mono title={root.path}>
              {shown}
            </Text>
          </ItemTitle>
          <ItemDescription>{status}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            aria-label={`Index ${shown}`}
            checked={root.enabled}
            disabled={disabled}
            onCheckedChange={onToggle}
          />
          <IconButton
            disabled={disabled}
            label={`Remove ${shown}`}
            onClick={onRemove}
          >
            <Trash2 />
          </IconButton>
        </ItemActions>
      </Item>
    </li>
  );
}

function RemoveFolderDialog({
  shown,
  open,
  removing,
  onOpenChange,
  onConfirm,
}: {
  shown: string;
  open: boolean;
  removing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!removing) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this folder?</AlertDialogTitle>
          <AlertDialogDescription>
            Its files leave the Library. Nothing is deleted from disk, and
            adding the folder again brings them back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody>
          <Text as="p" className="break-all" mono>
            {shown}
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogClose disabled={removing}>Cancel</AlertDialogClose>
          <Button
            disabled={removing}
            onClick={onConfirm}
            tone="danger"
            variant="solid"
          >
            Remove folder
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The directories the app indexes: add, pause or drop one, and the index follows. */
export function FoldersSection({
  scan,
  onFoldersChanged,
}: {
  scan: UseScan;
  onFoldersChanged: () => void;
}) {
  const index = useLibraryIndex();
  const home = useHomeDirectory();
  const [busy, setBusy] = useState<number | "add" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [removal, setRemoval] = useState<Root | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [queuedScan, setQueuedScan] = useState<QueuedScan | null>(null);

  const filesByFolder = useMemo(() => {
    const counts = new Map<number, number>();
    for (const file of index.files) {
      counts.set(file.rootId, (counts.get(file.rootId) ?? 0) + 1);
    }
    return counts;
  }, [index.files]);

  // Only one scan runs at a time: a change made during a scan waits for it to end.
  const { running, start } = scan;
  useEffect(() => {
    if (queuedScan !== null && !running) {
      setQueuedScan(null);
      start(queuedScan.rootIds);
    }
  }, [queuedScan, running, start]);

  /** Applies one change to the folders, then brings the index in line with it. */
  const apply = async (
    key: number | "add",
    change: () => Promise<QueuedScan>
  ) => {
    setBusy(key);
    setFailure(null);
    try {
      const rescan = await change();
      onFoldersChanged();
      await index.refresh();
      // Two changes waiting on the same scan are covered by one full scan.
      setQueuedScan((queued) => (queued === null ? rescan : FULL_SCAN));
    } catch (cause) {
      setFailure(toIpcError(cause).message);
    } finally {
      setBusy(null);
    }
  };

  const handleAdd = async () => {
    const picked = await openFolderDialog({
      directory: true,
      multiple: false,
      defaultPath: home ?? undefined,
      title: "Choose a folder to index",
    });
    if (typeof picked !== "string") {
      return;
    }
    await apply("add", async () => {
      const root = await addRoot(picked);
      return { rootIds: [root.id] };
    });
  };

  const handleToggle = (root: Root, enabled: boolean) =>
    apply(root.id, async () => {
      await setRootEnabled(root.id, enabled);
      return enabled ? { rootIds: [root.id] } : FULL_SCAN;
    });

  const handleRemove = async (root: Root) => {
    await apply(root.id, async () => {
      await removeRoot(root.id);
      return FULL_SCAN;
    });
    setConfirming(false);
  };

  const hasFolders = index.roots.length > 0;
  const loadFailure = hasFolders ? null : index.error;
  // A refresh that fails keeps the folders already listed, so it is reported above them.
  const shownFailure = failure ?? (hasFolders ? index.error : null);

  const addButton = (
    <Button
      className="shrink-0"
      disabled={busy === "add"}
      onClick={() => {
        handleAdd();
      }}
      variant="surface"
    >
      <FolderPlus />
      Add folder…
    </Button>
  );

  return (
    <SettingsSection
      action={hasFolders ? addButton : undefined}
      description="The app looks in these folders for skills (any SKILL.md), Claude agents, Cursor rules, and AGENTS.md, CLAUDE.md and GEMINI.md files."
      title="Folders"
    >
      {shownFailure === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>The folders could not be updated</AlertTitle>
          <AlertDescription>{shownFailure}</AlertDescription>
        </Alert>
      )}
      {index.ready ? null : <ListSkeleton rows={2} />}
      {index.ready && loadFailure !== null ? (
        <ErrorState message={loadFailure} onRetry={index.refresh} />
      ) : null}
      {index.ready && loadFailure === null && !hasFolders ? (
        <EmptyState
          action={addButton}
          description="Nothing shows up in the Library until you add one."
          icon={Folder}
          title="No folders yet"
        />
      ) : null}
      {hasFolders ? (
        <ul
          aria-label="Indexed folders"
          className="flex flex-col divide-y divide-border"
        >
          {index.roots.map((root) => (
            <FolderRow
              disabled={busy === root.id}
              key={root.id}
              onRemove={() => {
                setRemoval(root);
                setConfirming(true);
              }}
              onToggle={(enabled) => {
                handleToggle(root, enabled);
              }}
              root={root}
              shown={displayPath(root.path, home)}
              status={folderStatus(
                root,
                filesByFolder.get(root.id) ?? 0,
                scan.running
              )}
            />
          ))}
        </ul>
      ) : null}
      <RemoveFolderDialog
        onConfirm={() => {
          if (removal !== null) {
            handleRemove(removal);
          }
        }}
        onOpenChange={setConfirming}
        open={confirming}
        removing={removal !== null && busy === removal.id}
        shown={removal === null ? "" : displayPath(removal.path, home)}
      />
    </SettingsSection>
  );
}
