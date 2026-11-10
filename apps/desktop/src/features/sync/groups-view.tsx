import { Button } from "@ctrl-ui/react/ui/button";
import { History, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { onIndexUpdated } from "@/lib/events";
import { useHomeDirectory } from "@/lib/home-dir";
import { listSyncGroups, toIpcError } from "@/lib/ipc";
import type { FileRow, SyncGroupView } from "@/lib/ipc-types";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  ViewLayout,
} from "@/shared/components/view-layout";

import { ApplySyncDialog } from "./apply-sync-dialog";
import { BackupsDialog } from "./backups-dialog";
import { CreateGroupDialog } from "./create-group-dialog";
import { RemoveGroupDialog } from "./remove-group-dialog";
import { notifySyncGroupsChanged, useSyncGroupsChanged } from "./sync-events";
import { SyncGroupCard } from "./sync-group-card";

/** A dialog keeps showing its group while it closes, so the two are tracked apart. */
interface GroupDialog {
  group: SyncGroupView | null;
  open: boolean;
}

const NO_DIALOG: GroupDialog = { group: null, open: false };

export function GroupsView({
  onOpenFile,
}: {
  onOpenFile: (file: FileRow) => void;
}) {
  const home = useHomeDirectory();
  const [groups, setGroups] = useState<SyncGroupView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [review, setReview] = useState(NO_DIALOG);
  const [removal, setRemoval] = useState(NO_DIALOG);

  const refresh = useCallback(async () => {
    try {
      setGroups(await listSyncGroups());
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = onIndexUpdated(() => {
      refresh();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [refresh]);

  useSyncGroupsChanged(refresh);

  const isEmpty = !(loading || error) && groups.length === 0;

  return (
    <ViewLayout
      actions={
        <>
          <Button
            onClick={() => setBackupsOpen(true)}
            size="sm"
            variant="ghost"
          >
            <History />
            Backups
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            variant="surface"
          >
            <Plus />
            New group
          </Button>
        </>
      }
      description="Files in a group follow one source. Applying a sync overwrites them with it and keeps a backup of what they contained."
      title="Sync"
    >
      {loading ? <ListSkeleton rows={3} /> : null}

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {isEmpty ? (
        <EmptyState
          action={
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              tone="primary"
              variant="solid"
            >
              <Plus />
              New group
            </Button>
          }
          description="Create one here, or turn identical files into a group from Duplicates."
          icon={RefreshCw}
          title="No sync groups yet"
        />
      ) : null}

      {groups.map((group) => (
        <SyncGroupCard
          group={group}
          home={home}
          key={group.id}
          onOpenFile={onOpenFile}
          onRemove={() => setRemoval({ group, open: true })}
          onReview={() => setReview({ group, open: true })}
        />
      ))}

      <CreateGroupDialog
        onCreated={notifySyncGroupsChanged}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
      <ApplySyncDialog
        group={review.group}
        onApplied={notifySyncGroupsChanged}
        onOpenBackups={() => setBackupsOpen(true)}
        onOpenChange={(open) => setReview((current) => ({ ...current, open }))}
        open={review.open}
      />
      <RemoveGroupDialog
        group={removal.group}
        onOpenChange={(open) => setRemoval((current) => ({ ...current, open }))}
        onRemoved={notifySyncGroupsChanged}
        open={removal.open}
      />
      <BackupsDialog
        onOpenChange={setBackupsOpen}
        onRestored={notifySyncGroupsChanged}
        open={backupsOpen}
      />
    </ViewLayout>
  );
}
