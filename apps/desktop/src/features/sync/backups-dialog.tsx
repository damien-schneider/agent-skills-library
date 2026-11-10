import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ctrl-ui/react/ui/alert";
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ctrl-ui/react/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
} from "@ctrl-ui/react/ui/item";
import { ScrollArea } from "@ctrl-ui/react/ui/scroll-area";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { pathName } from "@/features/library/library-model";
import { useHomeDirectory } from "@/lib/home-dir";
import { listBackups, restoreBackup, toIpcError } from "@/lib/ipc";
import type { Backup } from "@/lib/ipc-types";
import { ListSkeleton } from "@/shared/components/view-layout";

import { relativeTime } from "./relative-time";

const DIALOG_STYLE = { "--cui-popup-dialog-max-inline-size": "40rem" } as const;

const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-padding-block": "calc(var(--spacing) * 1.5)",
  "--cui-item-description-font-size": "var(--text-label)",
} as const;

type BackupsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; backups: Backup[] };

export function BackupsDialog({
  open,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle>Backups</DialogTitle>
          <DialogDescription>
            What each file contained before a sync overwrote it, newest first.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <BackupList
            onRestored={() => {
              onRestored();
              onOpenChange(false);
            }}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog, so every opening reads the backups afresh. */
function BackupList({ onRestored }: { onRestored: () => void }) {
  const home = useHomeDirectory();
  const [state, setState] = useState<BackupsState>({ status: "loading" });
  const [target, setTarget] = useState<Backup | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", backups: await listBackups() });
    } catch (cause) {
      setState({ status: "error", message: toIpcError(cause).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") {
    return <ListSkeleton rows={3} />;
  }

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Backups could not be read</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
        <AlertAction>
          <Button
            onClick={() => {
              load();
            }}
            size="sm"
            variant="surface"
          >
            Try again
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (state.backups.length === 0) {
    return (
      <Text as="p" tone="muted">
        Nothing has been overwritten yet.
      </Text>
    );
  }

  return (
    <>
      <ScrollArea maxHeight="50vh">
        <ItemGroup aria-label="Backups">
          {state.backups.map((backup) => (
            <BackupRow
              backup={backup}
              home={home}
              key={backup.id}
              onRestore={() => {
                setTarget(backup);
                setConfirmOpen(true);
              }}
            />
          ))}
        </ItemGroup>
      </ScrollArea>
      <RestoreBackupDialog
        backup={target}
        home={home}
        onOpenChange={setConfirmOpen}
        onRestored={onRestored}
        open={confirmOpen}
      />
    </>
  );
}

function BackupRow({
  backup,
  home,
  onRestore,
}: {
  backup: Backup;
  home: string | null;
  onRestore: () => void;
}) {
  const saved = new Date(backup.createdAt);
  const when = relativeTime(backup.createdAt);
  return (
    <Item role="listitem" style={ROW_STYLE}>
      <ItemContent>
        <Text
          as="div"
          className="truncate"
          mono
          size="label"
          title={backup.originalPath}
        >
          {displayPath(backup.originalPath, home)}
        </Text>
        <ItemDescription>
          <time dateTime={saved.toISOString()} title={saved.toLocaleString()}>
            {when}
          </time>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          aria-label={`Restore ${pathName(backup.originalPath)} from ${when}`}
          onClick={onRestore}
          size="sm"
          variant="surface"
        >
          Restore
        </Button>
      </ItemActions>
    </Item>
  );
}

/** Restoring overwrites the file again, and this time nothing keeps a copy. */
function RestoreBackupDialog({
  backup,
  home,
  open,
  onOpenChange,
  onRestored,
}: {
  backup: Backup | null;
  home: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}) {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!backup) {
      return;
    }
    setRestoring(true);
    setError(null);
    try {
      await restoreBackup(backup.id);
      toast.success(`Restored ${pathName(backup.originalPath)}`, {
        description: displayPath(backup.originalPath, home),
      });
      onOpenChange(false);
      onRestored();
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restore {backup ? pathName(backup.originalPath) : "this backup"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The file goes back to what it contained before it was overwritten
            {backup ? ` ${relativeTime(backup.createdAt)}` : ""}. What it
            contains now is replaced and not backed up.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody>
          {backup ? (
            <Text as="p" className="break-all" mono>
              {displayPath(backup.originalPath, home)}
            </Text>
          ) : null}
          {error ? (
            <Text as="p" role="alert" tone="destructive">
              {error}
            </Text>
          ) : null}
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogClose disabled={restoring}>Cancel</AlertDialogClose>
          <Button
            disabled={restoring}
            onClick={() => {
              handleRestore();
            }}
            tone="danger"
            variant="solid"
          >
            {restoring ? <Spinner /> : null}
            Restore backup
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
