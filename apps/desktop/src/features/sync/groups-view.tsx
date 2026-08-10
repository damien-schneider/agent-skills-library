import { History, Link2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { onIndexUpdated } from "@/lib/events";
import {
  deleteSyncGroup,
  listSyncGroups,
  removeMember,
  setCanonical,
  toIpcError,
} from "@/lib/ipc";
import type { MemberStatus, SyncGroupView } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { ApplySyncDialog } from "./apply-sync-dialog";
import { BackupsDialog } from "./backups-dialog";
import { CreateGroupDialog } from "./create-group-dialog";

const STATUS_STYLES: Record<MemberStatus, string> = {
  "in-sync": "text-muted-foreground",
  drifted: "text-destructive",
  missing: "text-destructive",
  symlinked: "text-chart-3",
};

export function GroupsView() {
  const [groups, setGroups] = useState<SyncGroupView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [applyGroupId, setApplyGroupId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setGroups(await listSyncGroups());
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = onIndexUpdated(() => {
      refresh();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [refresh]);

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      toast.success(message);
      await refresh();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-5 overflow-auto px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">Sync groups</h1>
          <p className="text-muted-foreground text-sm">
            One source of truth, many followers. Nothing is written without a
            preview.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setBackupsOpen(true)}
            size="sm"
            variant="outline"
          >
            <History />
            Backups
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus />
            New group
          </Button>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {groups.length === 0 && !error ? (
        <p className="text-muted-foreground text-sm">
          No sync groups yet — create one here or from the Duplicates view.
        </p>
      ) : null}

      {groups.map((group) => (
        <section className="rounded-xl border border-border" key={group.id}>
          <header className="flex items-center gap-2 border-border border-b px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{group.name}</p>
              <p className="truncate text-muted-foreground text-xs">
                source: {group.canonical?.path ?? "missing"}
              </p>
            </div>
            <Button
              disabled={group.members.length === 0}
              onClick={() => setApplyGroupId(group.id)}
              size="sm"
              variant="outline"
            >
              Preview & apply
            </Button>
            <Button
              onClick={() => {
                run(deleteSyncGroup(group.id), `Deleted ${group.name}`);
              }}
              size="sm"
              title="Delete group"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </header>

          <ul>
            {group.members.map((member) => (
              <li
                className="flex items-center gap-3 border-border border-b px-4 py-2 last:border-b-0"
                key={member.file.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{member.file.relPath}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {member.file.path}
                  </p>
                </div>
                {member.strategy === "symlink" ? (
                  <Link2 className="size-3.5 shrink-0 text-chart-3" />
                ) : null}
                <span
                  className={`shrink-0 text-xs ${STATUS_STYLES[member.status]}`}
                >
                  {member.status}
                </span>
                <Button
                  onClick={() => {
                    run(
                      setCanonical(group.id, member.file.id),
                      `${member.file.relPath} is now the source`
                    );
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Promote
                </Button>
                <Button
                  onClick={() => {
                    run(
                      removeMember(group.id, member.file.id),
                      `Removed ${member.file.relPath}`
                    );
                  }}
                  size="sm"
                  title="Remove from group"
                  variant="ghost"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
            {group.members.length === 0 ? (
              <li className="px-4 py-2 text-muted-foreground text-sm">
                No members yet.
              </li>
            ) : null}
          </ul>
        </section>
      ))}

      <CreateGroupDialog
        onCreated={refresh}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
      <ApplySyncDialog
        groupId={applyGroupId}
        onApplied={refresh}
        onOpenChange={(open) => setApplyGroupId(open ? applyGroupId : null)}
        open={applyGroupId !== null}
      />
      <BackupsDialog
        onOpenChange={setBackupsOpen}
        onRestored={refresh}
        open={backupsOpen}
      />
    </div>
  );
}
