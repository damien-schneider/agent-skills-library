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
import { SidebarMenuButton, SidebarMenuItem } from "@ctrl-ui/react/ui/sidebar";
import { ArrowDownToLine } from "lucide-react";
import { useState } from "react";

import { fileTitle } from "@/features/library/library-model";
import type { FileRow } from "@/lib/ipc-types";

import type { UseAppUpdate } from "./use-app-update";

/**
 * Appears in the sidebar only once a new version is ready. Installing restarts
 * the app, so it always asks first and names the edits a restart would lose.
 */
export function UpdateButton({
  update,
  unsavedFile,
}: {
  update: Pick<UseAppUpdate, "pending" | "installing" | "install">;
  unsavedFile: FileRow | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending, installing, install } = update;
  if (!pending) {
    return null;
  }
  const label = `Update to ${pending.version}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setConfirming(true)} tooltip={label}>
        <ArrowDownToLine />
        <span>{label}</span>
      </SidebarMenuButton>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute end-1 top-1 size-1.5 rounded-full bg-primary"
      />
      <AlertDialog
        onOpenChange={(open) => {
          if (!installing) {
            setConfirming(open);
          }
        }}
        open={confirming}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Install version {pending.version}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unsavedFile
                ? `The app restarts to finish updating. Your unsaved changes to ${fileTitle(unsavedFile)} will be lost.`
                : "The app restarts to finish updating."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={installing}>Not now</AlertDialogClose>
            <Button
              disabled={installing}
              onClick={install}
              tone="primary"
              variant="solid"
            >
              {installing ? "Installing…" : "Install and restart"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenuItem>
  );
}
