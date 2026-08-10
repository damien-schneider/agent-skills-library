import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createSyncGroup, listFiles, toIpcError } from "@/lib/ipc";
import type { FileRow, SyncStrategy } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [canonicalId, setCanonicalId] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [strategy, setStrategy] = useState<SyncStrategy>("copy");

  useEffect(() => {
    if (!open) {
      return;
    }
    listFiles()
      .then(setFiles)
      .catch((cause) => toast.error(toIpcError(cause).message));
  }, [open]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matching =
      needle.length === 0
        ? files
        : files.filter((file) => file.path.toLowerCase().includes(needle));
    return matching.slice(0, 200);
  }, [files, search]);

  const reset = () => {
    setName("");
    setCanonicalId(null);
    setMemberIds([]);
    setSearch("");
    setStrategy("copy");
  };

  const toggleMember = (fileId: number) => {
    setMemberIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId]
    );
  };

  const handleCreate = async () => {
    if (canonicalId === null) {
      return;
    }
    try {
      await createSyncGroup({
        name: name.trim() || "Untitled group",
        canonicalFileId: canonicalId,
        memberFileIds: memberIds.filter((id) => id !== canonicalId),
        strategy,
      });
      toast.success("Sync group created");
      reset();
      onCreated();
      onOpenChange(false);
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New sync group</DialogTitle>
          <DialogDescription>
            Pick one source of truth, then the files that should follow it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            onChange={(event) => setName(event.target.value)}
            placeholder="Group name"
            value={name}
          />
          <Input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter files by path"
            value={search}
          />

          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Strategy</span>
            {(["copy", "symlink"] as const).map((option) => (
              <label className="flex items-center gap-1.5" key={option}>
                <input
                  checked={strategy === option}
                  className="size-3.5 accent-primary"
                  name="strategy"
                  onChange={() => setStrategy(option)}
                  type="radio"
                />
                {option}
              </label>
            ))}
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            {visible.map((file) => (
              <div
                className="flex items-center gap-3 border-border border-b px-3 py-1.5 last:border-b-0"
                key={file.id}
              >
                <input
                  checked={canonicalId === file.id}
                  className="size-3.5 accent-primary"
                  name="canonical"
                  onChange={() => setCanonicalId(file.id)}
                  title="Source of truth"
                  type="radio"
                />
                <input
                  checked={memberIds.includes(file.id)}
                  className="size-3.5 accent-primary"
                  disabled={canonicalId === file.id}
                  onChange={() => toggleMember(file.id)}
                  title="Member"
                  type="checkbox"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {file.relPath}
                </span>
                <span className="shrink-0 truncate text-muted-foreground text-xs">
                  {file.path}
                </span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Radio = source of truth · checkbox = follows it
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={canonicalId === null}
            onClick={() => {
              handleCreate();
            }}
          >
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
