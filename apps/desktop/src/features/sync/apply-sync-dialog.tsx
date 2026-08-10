import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { applySync, previewSync, toIpcError } from "@/lib/ipc";
import type { MemberPlan, SyncPreview, SyncWarning } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { DiffLines } from "./diff-lines";

const WARNING_TEXT: Record<SyncWarning, string> = {
  "git-tracked":
    "tracked by git — a committed symlink breaks CI and collaborators",
  "windows-symlink": "Windows needs Developer Mode to create symlinks",
  "cloud-folder": "cloud-synced folder — symlinks are often replaced by copies",
  "existing-symlink": "already a symlink; it will be replaced",
};

const ACTION_TEXT = {
  skip: "already in sync",
  copy: "overwrite with a copy",
  symlink: "replace with a symlink",
  create: "create the missing file",
} as const;

export function ApplySyncDialog({
  groupId,
  open,
  onOpenChange,
  onApplied,
}: {
  groupId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}) {
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!(open && groupId !== null)) {
      setPreview(null);
      setError(null);
      return;
    }
    previewSync(groupId)
      .then((result) => {
        setPreview(result);
        setError(null);
      })
      .catch((cause) => setError(toIpcError(cause).message));
  }, [groupId, open]);

  const handleApply = async () => {
    if (!preview) {
      return;
    }
    setApplying(true);
    try {
      const result = await applySync(preview.groupId, preview.token);
      toast.success(
        `${result.updatedFileIds.length} updated · ${result.skipped} skipped · ${result.backupIds.length} backed up`
      );
      onApplied();
      onOpenChange(false);
    } catch (cause) {
      const ipcError = toIpcError(cause);
      setError(
        ipcError.code === "conflict"
          ? "A file changed since this preview. Close and preview again."
          : ipcError.message
      );
    } finally {
      setApplying(false);
    }
  };

  const pending =
    preview?.members.filter((member) => member.action !== "skip") ?? [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Apply sync{preview ? `: ${preview.groupName}` : ""}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? `Source of truth: ${preview.canonicalPath}. Every overwritten file is backed up first.`
              : "Building the plan…"}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="max-h-[55vh] overflow-auto">
          {preview?.members.map((member) => (
            <MemberRow key={member.fileId} member={member} />
          ))}
          {preview && preview.members.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This group has no members yet.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={applying || pending.length === 0}
            onClick={() => {
              handleApply();
            }}
          >
            {applying ? "Applying…" : `Apply to ${pending.length} files`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member }: { member: MemberPlan }) {
  return (
    <div className="border-border border-b py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">
          {member.relPath}
        </span>
        <span className="shrink-0 text-muted-foreground text-xs">
          {ACTION_TEXT[member.action]}
        </span>
      </div>
      <p className="truncate text-muted-foreground text-xs">{member.path}</p>

      {member.warnings.map((warning) => (
        <p
          className="mt-1 flex items-center gap-1.5 text-destructive text-xs"
          key={warning}
        >
          <AlertTriangle className="size-3" />
          {WARNING_TEXT[warning]}
        </p>
      ))}

      {member.diff ? (
        <div className="mt-2">
          <DiffLines diff={member.diff} />
        </div>
      ) : null}
    </div>
  );
}
