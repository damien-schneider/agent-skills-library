import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { Copy, Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { onIndexUpdated } from "@/lib/events";
import { createSyncGroup, listDuplicates, toIpcError } from "@/lib/ipc";
import type { DuplicateGroup, FileRow } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";

export function DuplicatesView({
  onGroupCreated,
}: {
  onGroupCreated: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setGroups(await listDuplicates());
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setLoading(false);
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

  const handleCreateGroup = async (
    group: DuplicateGroup,
    canonical: FileRow
  ) => {
    try {
      await createSyncGroup({
        name: canonical.relPath,
        canonicalFileId: canonical.id,
        memberFileIds: group.files
          .filter((file) => file.id !== canonical.id)
          .map((file) => file.id),
      });
      toast.success(`Sync group created from ${canonical.relPath}`);
      onGroupCreated();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-5 overflow-auto px-8 py-8">
      <div>
        <h1 className="font-semibold text-lg">Duplicates</h1>
        <p className="text-muted-foreground text-sm">
          Files sharing the exact same content. Pick a source of truth to turn a
          group into a sync group.
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {groups.length === 0 && !error ? (
        <p className="text-muted-foreground text-sm">
          No duplicate content in the index.
        </p>
      ) : null}

      {groups.map((group) => (
        <section className="rounded-xl border border-border" key={group.hash}>
          <header className="flex items-center gap-2 border-border border-b px-4 py-2">
            <Copy className="size-3.5 text-muted-foreground" />
            <span className="font-medium text-sm">
              {group.files.length} identical files
            </span>
            <code className="ml-auto text-muted-foreground text-xs">
              {group.hash.slice(0, 12)}
            </code>
          </header>
          <ul>
            {group.files.map((file) => (
              <li
                className="flex items-center gap-3 border-border border-b px-4 py-2 last:border-b-0"
                key={file.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{file.relPath}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {targetLabel(file.kind)} · {file.path}
                  </p>
                </div>
                {file.isSymlink ? (
                  <Link2 className="size-3.5 shrink-0 text-chart-3" />
                ) : null}
                <Button
                  onClick={() => {
                    handleCreateGroup(group, file);
                  }}
                  size="sm"
                  variant="outline"
                >
                  Use as source
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
