import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ctrl-ui/react/ui/alert";
import { Badge, type BadgeColor } from "@ctrl-ui/react/ui/badge";
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
import { ScrollArea } from "@ctrl-ui/react/ui/scroll-area";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { useHomeDirectory } from "@/lib/home-dir";
import { applySync, previewSync, toIpcError } from "@/lib/ipc";
import type {
  ApplyResult,
  MemberPlan,
  SyncAction,
  SyncGroupView,
  SyncPreview,
  SyncWarning,
} from "@/lib/ipc-types";

import { DiffLines } from "./diff-lines";

const DIALOG_STYLE = { "--cui-popup-dialog-max-inline-size": "48rem" } as const;

const BACKUP_TOAST_MS = 10_000;

const WARNING_TEXT: Record<SyncWarning, string> = {
  "git-tracked":
    "Tracked by git: a committed symlink breaks CI and collaborators.",
  "windows-symlink": "Windows needs Developer Mode to create symlinks.",
  "cloud-folder":
    "In a cloud-synced folder, where symlinks are often replaced by copies.",
  "existing-symlink": "Already a symlink; it will be replaced.",
};

const ACTIONS: Record<SyncAction, { label: string; color: BadgeColor }> = {
  skip: { label: "No change", color: "neutral" },
  copy: { label: "Overwrite", color: "orange" },
  symlink: { label: "Replace with symlink", color: "orange" },
  create: { label: "Create file", color: "blue" },
};

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: SyncPreview };

function fileCount(count: number): string {
  return count === 1 ? "1 file" : `${count} files`;
}

export function ApplySyncDialog({
  group,
  open,
  onOpenChange,
  onApplied,
  onOpenBackups,
}: {
  group: SyncGroupView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
  onOpenBackups: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent style={DIALOG_STYLE}>
        {group ? (
          <SyncPlan
            group={group}
            onApplied={onApplied}
            onClose={() => onOpenChange(false)}
            onOpenBackups={onOpenBackups}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function announceApplied(result: ApplyResult, onOpenBackups: () => void) {
  const title = `Synced ${fileCount(result.updatedFileIds.length)}`;
  if (result.backupIds.length === 0) {
    toast.success(title);
    return;
  }
  const id = toast.success(title, {
    description: "What they contained before is kept in Backups.",
    timeout: BACKUP_TOAST_MS,
    actionProps: {
      children: "Open backups",
      onClick: () => {
        toast.dismiss(id);
        onOpenBackups();
      },
    },
  });
}

/** Mounted with the dialog, so every opening builds the plan from disk afresh. */
function SyncPlan({
  group,
  onApplied,
  onClose,
  onOpenBackups,
}: {
  group: SyncGroupView;
  onApplied: () => void;
  onClose: () => void;
  onOpenBackups: () => void;
}) {
  const home = useHomeDirectory();
  const groupId = group.id;
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    setApplyError(null);
    try {
      setState({ status: "ready", preview: await previewSync(groupId) });
    } catch (cause) {
      setState({ status: "error", message: toIpcError(cause).message });
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const preview = state.status === "ready" ? state.preview : null;
  const pendingCount =
    preview?.members.filter((member) => member.action !== "skip").length ?? 0;
  const nothingPending = preview !== null && pendingCount === 0;

  const handleApply = async () => {
    if (!preview) {
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const result = await applySync(preview.groupId, preview.token);
      onApplied();
      onClose();
      announceApplied(result, onOpenBackups);
    } catch (cause) {
      const ipcError = toIpcError(cause);
      setApplyError(
        ipcError.code === "conflict"
          ? "A file changed after this preview was built. Nothing was written."
          : ipcError.message
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sync “{group.name}”</DialogTitle>
        <DialogDescription>
          The files marked below are replaced with the source. What each one
          contains now is kept in Backups first.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        {applyError ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>The sync was not applied</AlertTitle>
            <AlertDescription>{applyError}</AlertDescription>
            <AlertAction>
              <Button
                onClick={() => {
                  load();
                }}
                size="sm"
                variant="surface"
              >
                Refresh preview
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {state.status === "loading" ? (
          <div className="flex items-center gap-2">
            <Spinner label="Building the preview" />
            <Text tone="muted">Comparing each file with the source…</Text>
          </div>
        ) : null}

        {state.status === "error" ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>The preview could not be built</AlertTitle>
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
        ) : null}

        {preview ? <PlanDetails home={home} preview={preview} /> : null}
      </DialogBody>

      <DialogFooter>
        <DialogClose disabled={applying}>
          {nothingPending ? "Close" : "Cancel"}
        </DialogClose>
        {nothingPending ? null : (
          <Button
            disabled={!preview || applying}
            onClick={() => {
              handleApply();
            }}
            tone="primary"
            variant="solid"
          >
            {applying ? <Spinner /> : null}
            {preview ? `Apply to ${fileCount(pendingCount)}` : "Apply"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function PlanDetails({
  preview,
  home,
}: {
  preview: SyncPreview;
  home: string | null;
}) {
  const pending = preview.members.filter((member) => member.action !== "skip");
  const unchanged = preview.members.filter(
    (member) => member.action === "skip"
  );
  // The files that change come first: those are the decision.
  const members = [...pending, ...unchanged];
  const nothingToApply = pending.length === 0;

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Badge color="primary">Source</Badge>
        <Text
          className="truncate"
          mono
          size="label"
          title={preview.canonicalPath}
        >
          {displayPath(preview.canonicalPath, home)}
        </Text>
      </div>

      {members.length === 0 ? (
        <Text as="p" tone="muted">
          This group has no other file to keep in sync yet.
        </Text>
      ) : null}

      {members.length > 0 && nothingToApply ? (
        <Text as="p" tone="muted">
          Every file already matches the source.
        </Text>
      ) : null}

      {members.length > 0 ? (
        <ScrollArea maxHeight="50vh">
          <ul className="flex flex-col gap-4 pr-3">
            {members.map((member) => (
              <MemberPlanItem home={home} key={member.fileId} member={member} />
            ))}
          </ul>
        </ScrollArea>
      ) : null}
    </>
  );
}

function MemberPlanItem({
  member,
  home,
}: {
  member: MemberPlan;
  home: string | null;
}) {
  const action = ACTIONS[member.action];
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Text
          className="min-w-0 flex-1 truncate"
          mono
          size="label"
          title={member.path}
        >
          {displayPath(member.path, home)}
        </Text>
        <Badge color={action.color}>{action.label}</Badge>
      </div>

      {member.warnings.map((warning) => (
        <Text
          as="p"
          className="flex items-start gap-1.5"
          key={warning}
          size="label"
          tone="warning"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {WARNING_TEXT[warning]}
        </Text>
      ))}

      {member.diff ? <DiffLines diff={member.diff} /> : null}
    </li>
  );
}
