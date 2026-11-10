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
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { useState } from "react";

import { deleteSyncGroup, toIpcError } from "@/lib/ipc";
import type { SyncGroupView } from "@/lib/ipc-types";

function filesKept(group: SyncGroupView): string {
  const count = group.members.length + (group.canonical ? 1 : 0);
  if (count === 0) {
    return "No file is touched.";
  }
  return count === 1
    ? "Its file stays on disk exactly as it is."
    : `Its ${count} files stay on disk exactly as they are.`;
}

export function RemoveGroupDialog({
  group,
  open,
  onOpenChange,
  onRemoved,
}: {
  group: SyncGroupView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    if (!group) {
      return;
    }
    setRemoving(true);
    setError(null);
    try {
      await deleteSyncGroup(group.id);
      onOpenChange(false);
      onRemoved();
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setRemoving(false);
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
            Remove “{group?.name ?? "this group"}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The group stops being tracked in Sync.{" "}
            {group ? filesKept(group) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <AlertDialogBody>
            <Text as="p" role="alert" tone="destructive">
              {error}
            </Text>
          </AlertDialogBody>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogClose disabled={removing}>Cancel</AlertDialogClose>
          <Button
            disabled={removing}
            onClick={() => {
              handleRemove();
            }}
            tone="danger"
            variant="solid"
          >
            {removing ? <Spinner /> : null}
            Remove group
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
