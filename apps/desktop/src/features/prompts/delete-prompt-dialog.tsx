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

import { deletePrompt, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";

function consequence(attachmentCount: number): string {
  if (attachmentCount === 0) {
    return "This cannot be undone.";
  }
  const images =
    attachmentCount === 1
      ? "Its attached image is"
      : `Its ${attachmentCount} attached images are`;
  return `${images} deleted with it. This cannot be undone.`;
}

/** Deleting removes the prompt and its image files for good, so it is always
 * confirmed against the prompt it is about to remove. */
export function DeletePromptDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: PromptHistoryEntry | null;
  onClose: () => void;
  onDeleted: (entry: PromptHistoryEntry) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The dialog keeps showing the prompt while it animates out.
  const [shown, setShown] = useState(entry);
  if (entry && entry !== shown) {
    setShown(entry);
  }

  const handleOpenChange = (open: boolean) => {
    if (open || deleting) {
      return;
    }
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!entry) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deletePrompt(entry.id);
      onDeleted(entry);
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={entry !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this prompt?</AlertDialogTitle>
          <AlertDialogDescription>
            {consequence(shown?.attachments.length ?? 0)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody className="flex flex-col gap-3">
          <div className="border-border border-s-2 ps-3">
            <Text
              as="blockquote"
              className="line-clamp-4 whitespace-pre-wrap break-words"
              tone="muted"
            >
              {shown?.content}
            </Text>
          </div>
          {error ? (
            <Text role="alert" size="label" tone="destructive">
              {error}
            </Text>
          ) : null}
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogClose disabled={deleting}>Cancel</AlertDialogClose>
          <Button
            disabled={deleting}
            onClick={confirm}
            tone="danger"
            variant="solid"
          >
            {deleting ? <Spinner aria-hidden="true" /> : null}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
