import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { Copy, Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { onIndexUpdated } from "@/lib/events";
import { createSyncGroup, listDuplicates, toIpcError } from "@/lib/ipc";
import type { DuplicateGroup, FileRow } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  ViewHeader,
  ViewLayout,
} from "@/shared/components/view-layout";

export function DuplicatesView({
  onGroupCreated,
}: {
  onGroupCreated: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [creatingHash, setCreatingHash] = useState<string | null>(null);
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
    setCreatingHash(group.hash);
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
    } finally {
      setCreatingHash(null);
    }
  };

  if (loading) {
    return (
      <ViewLayout>
        <ViewHeader
          description="Choose one source of truth for files with identical content."
          title="Duplicates"
        />
        <ListSkeleton rows={4} />
      </ViewLayout>
    );
  }

  return (
    <ViewLayout>
      <ViewHeader
        description="Choose one source of truth for files with identical content."
        title="Duplicates"
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {groups.length === 0 && !error ? (
        <EmptyState
          description="Files with matching content will appear here after indexing."
          icon={Copy}
          title="No duplicate content"
        />
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
                  disabled={creatingHash !== null}
                  onClick={() => {
                    handleCreateGroup(group, file);
                  }}
                  size="sm"
                  variant="outline"
                >
                  {creatingHash === group.hash ? "Creating…" : "Use as source"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ViewLayout>
  );
}
