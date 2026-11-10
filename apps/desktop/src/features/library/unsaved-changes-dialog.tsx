import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ctrl-ui/react/ui/alert-dialog";
import { Button } from "@ctrl-ui/react/ui/button";

import { fileTitle } from "./library-model";
import type { UseLibraryFile } from "./use-library-file";

/** Opening another file never drops edits silently: the choice is always explicit. */
export function UnsavedChangesDialog({ library }: { library: UseLibraryFile }) {
  const { pending, file } = library;
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          library.cancelPending();
        }
      }}
      open={pending !== null}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Discard changes to {file ? fileTitle(file) : "this file"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your edits have not been saved. Opening{" "}
            {pending ? fileTitle(pending) : "another file"} now will lose them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose>Keep editing</AlertDialogClose>
          <Button
            onClick={library.confirmPending}
            tone="danger"
            variant="solid"
          >
            Discard changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
