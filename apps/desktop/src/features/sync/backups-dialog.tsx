import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listBackups, restoreBackup, toIpcError } from "@/lib/ipc";
import type { Backup } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

export function BackupsDialog({
  open,
  onOpenChange,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    listBackups()
      .then((result) => {
        setBackups(result);
        setError(null);
      })
      .catch((cause) => setError(toIpcError(cause).message));
  }, [open]);

  const handleRestore = async (backup: Backup) => {
    try {
      await restoreBackup(backup.id);
      toast.success(`Restored ${backup.originalPath}`);
      onRestored();
      onOpenChange(false);
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Backups</DialogTitle>
          <DialogDescription>
            Every file a sync overwrote, newest first.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="max-h-[55vh] overflow-auto">
          {backups.map((backup) => (
            <div
              className="flex items-center gap-3 border-border border-b py-2 last:border-b-0"
              key={backup.id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{backup.originalPath}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {new Date(backup.createdAt).toLocaleString()} ·{" "}
                  {backup.hash.slice(0, 12)}
                </p>
              </div>
              <Button
                onClick={() => {
                  handleRestore(backup);
                }}
                size="sm"
                variant="outline"
              >
                Restore
              </Button>
            </div>
          ))}
          {backups.length === 0 && !error ? (
            <p className="text-muted-foreground text-sm">No backups yet.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
