import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ctrl-ui/react/ui/alert";
import { Button } from "@ctrl-ui/react/ui/button";

import type { UseFileContent } from "../use-file-content";

/** States of the open file that need a decision, shown between the header and the text. */
export function EditorNotices({ editor }: { editor: UseFileContent }) {
  const openedAsSource =
    editor.buffer !== null && editor.buffer.rich === null && !editor.dirty;
  if (!(editor.changedOnDisk || editor.error || openedAsSource)) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b px-4 py-3">
      {editor.changedOnDisk ? (
        <Alert>
          <AlertTitle>This file changed on disk</AlertTitle>
          <AlertDescription>
            Your unsaved edits were made on the earlier version.
          </AlertDescription>
          <AlertAction>
            <Button onClick={editor.reload} size="sm" variant="surface">
              Discard my edits and reload
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {editor.error ? (
        <Alert variant="destructive">
          <AlertTitle>The file was not saved</AlertTitle>
          <AlertDescription>{editor.error}</AlertDescription>
        </Alert>
      ) : null}
      {openedAsSource ? (
        <Alert>
          <AlertTitle>Opened as source</AlertTitle>
          <AlertDescription>
            The visual editor could not show this file without changing its
            formatting.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
