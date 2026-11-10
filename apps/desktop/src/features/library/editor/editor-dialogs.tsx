import { Alert, AlertDescription } from "@ctrl-ui/react/ui/alert";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrl-ui/react/ui/dialog";
import { toast } from "@ctrl-ui/react/ui/toast";
import { useEffect, useState } from "react";

import { readFile, toIpcError, trashFile } from "@/lib/ipc";
import type { FileRow } from "@/lib/ipc-types";
import { DiffView } from "@/shared/components/diff-view";

import { fileTitle } from "../library-model";
import type { UseFileContent } from "../use-file-content";

/** What a save would write, before it is written. */
export function ReviewChangesDialog({
  editor,
  onOpenChange,
  open,
}: {
  editor: UseFileContent;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review changes</DialogTitle>
          <DialogDescription>
            The saved file compared with what Save will write.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DiffView
            after={editor.documentText}
            before={editor.buffer?.content.content ?? ""}
            className="max-h-[60vh]"
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose>Keep editing</DialogClose>
          <Button
            disabled={!editor.dirty || editor.saving}
            onClick={async () => {
              if (await editor.save()) {
                onOpenChange(false);
              }
            }}
            tone="primary"
            variant="solid"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The text on disk right now, read when a conflict needs to be shown. */
function useDiskText(fileId: number, enabled: boolean): string | null {
  const [disk, setDisk] = useState<{ fileId: number; text: string } | null>(
    null
  );
  useEffect(() => {
    if (!enabled) {
      setDisk(null);
      return;
    }
    let cancelled = false;
    readFile(fileId)
      .then((content) => {
        if (!cancelled) {
          setDisk({ fileId, text: content.content });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDisk(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, enabled]);
  return disk?.fileId === fileId ? disk.text : null;
}

/** A save was refused because the file changed underneath the editor. */
export function ConflictDialog({
  editor,
  file,
}: {
  editor: UseFileContent;
  file: FileRow;
}) {
  const diskText = useDiskText(file.id, editor.conflict);
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          editor.dismissConflict();
        }
      }}
      open={editor.conflict}
    >
      <AlertDialogContent className="sm:max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            “{fileTitle(file)}” changed on disk
          </AlertDialogTitle>
          <AlertDialogDescription>
            Something else modified it after you opened it, so nothing was
            saved. The file on disk is compared with your version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody>
          <DiffView
            after={editor.documentText}
            before={diskText ?? editor.buffer?.content.content ?? ""}
            className="max-h-[50vh]"
          />
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogClose>Keep editing</AlertDialogClose>
          <Button onClick={editor.reload} variant="surface">
            Discard my edits
          </Button>
          <Button onClick={editor.overwrite} tone="danger" variant="solid">
            Overwrite the file
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TrashDialog({
  dirty,
  file,
  onOpenChange,
  onTrashed,
  open,
}: {
  dirty: boolean;
  file: FileRow;
  onOpenChange: (open: boolean) => void;
  onTrashed: () => void;
  open: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = fileTitle(file);
  const isSkill = file.kind === "skill";

  const moveToTrash = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await trashFile(file.id);
      const links = result.removedLinks.length;
      toast.success(`Moved “${title}” to the Trash`, {
        description:
          links > 0
            ? `${links} ${links === 1 ? "symlink" : "symlinks"} to it ${links === 1 ? "was" : "were"} removed.`
            : undefined,
      });
      onOpenChange(false);
      onTrashed();
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!busy) {
          setError(null);
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move “{title}” to the Trash?</AlertDialogTitle>
          <AlertDialogDescription>
            {isSkill
              ? "The whole skill folder goes to the Trash, with every file in it."
              : "The file goes to the Trash."}
            {file.aliases.length > 0
              ? " Symlinks that point to it are removed."
              : ""}
            {dirty ? " Your unsaved edits are lost." : ""} You can put it back
            from the Trash.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <AlertDialogBody>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </AlertDialogBody>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogClose disabled={busy}>Cancel</AlertDialogClose>
          <Button
            disabled={busy}
            onClick={moveToTrash}
            tone="danger"
            variant="solid"
          >
            Move to Trash
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
