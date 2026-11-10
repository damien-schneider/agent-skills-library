import { Badge } from "@ctrl-ui/react/ui/badge";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrl-ui/react/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
} from "@ctrl-ui/react/ui/item";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { ArrowUpRight, Check, CopyCheck, Link2 } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { FileKindIcon } from "@/features/library/file-kind";
import { fileTitle } from "@/features/library/library-model";
import {
  notifySyncGroupsChanged,
  useSyncGroupsChanged,
} from "@/features/sync/sync-events";
import { onIndexUpdated } from "@/lib/events";
import { useHomeDirectory } from "@/lib/home-dir";
import {
  createSyncGroup,
  listDuplicates,
  listSyncGroups,
  toIpcError,
} from "@/lib/ipc";
import type { DuplicateGroup, FileRow, SyncGroupView } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  ViewLayout,
} from "@/shared/components/view-layout";

const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-padding-block": "calc(var(--spacing) * 1)",
} as const;

/** Copies already tracked together need no decision: one sync group holds them all. */
function isKeptInSync(
  group: DuplicateGroup,
  syncGroups: SyncGroupView[]
): boolean {
  return syncGroups.some((syncGroup) => {
    const tracked = new Set(syncGroup.members.map((member) => member.file.id));
    if (syncGroup.canonicalFileId !== null) {
      tracked.add(syncGroup.canonicalFileId);
    }
    return group.files.every((file) => tracked.has(file.id));
  });
}

export function DuplicatesView({
  onGroupCreated,
  onOpenFile,
}: {
  onGroupCreated: () => void;
  onOpenFile: (file: FileRow) => void;
}) {
  const home = useHomeDirectory();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [syncGroups, setSyncGroups] = useState<SyncGroupView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingHash, setCreatingHash] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    hash: string;
    message: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [duplicates, tracked] = await Promise.all([
        listDuplicates(),
        listSyncGroups(),
      ]);
      setGroups(duplicates);
      setSyncGroups(tracked);
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

  useSyncGroupsChanged(refresh);

  const keepInSync = async (group: DuplicateGroup) => {
    const [source, ...copies] = group.files;
    if (!source) {
      return;
    }
    setCreatingHash(group.hash);
    setFailure(null);
    try {
      await createSyncGroup({
        name: fileTitle(source),
        canonicalFileId: source.id,
        memberFileIds: copies.map((file) => file.id),
      });
      toast.success(`${fileTitle(source)} is now kept in sync`, {
        description: `Source: ${displayPath(source.path, home)}`,
      });
      notifySyncGroupsChanged();
      onGroupCreated();
    } catch (cause) {
      setFailure({ hash: group.hash, message: toIpcError(cause).message });
    } finally {
      setCreatingHash(null);
    }
  };

  // Groups still waiting for a decision come before the ones already handled.
  const pending = groups.filter((group) => !isKeptInSync(group, syncGroups));
  const handled = groups.filter((group) => isKeptInSync(group, syncGroups));
  const isEmpty = !(loading || error) && groups.length === 0;

  return (
    <ViewLayout
      description="Keep in sync tracks identical copies as one group in Sync, with the top copy as the source. Nothing on disk changes until you apply a sync there."
      title="Duplicates"
    >
      {loading ? <ListSkeleton rows={4} /> : null}

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {isEmpty ? (
        <EmptyState
          description="Every indexed file has content of its own."
          icon={CopyCheck}
          title="No duplicates"
        />
      ) : null}

      {pending.map((group) => (
        <DuplicateCard
          busy={creatingHash !== null}
          creating={creatingHash === group.hash}
          failure={failure?.hash === group.hash ? failure.message : null}
          group={group}
          home={home}
          key={group.hash}
          onKeepInSync={() => {
            keepInSync(group);
          }}
          onOpenFile={onOpenFile}
        />
      ))}
      {handled.map((group) => (
        <DuplicateCard
          group={group}
          home={home}
          key={group.hash}
          onOpenFile={onOpenFile}
        />
      ))}
    </ViewLayout>
  );
}

function kindSummary(files: FileRow[]): string {
  const labels = new Set(files.map((file) => targetLabel(file.kind)));
  return `${[...labels].join(", ")} · ${files.length} copies`;
}

function DuplicateCard({
  group,
  home,
  onOpenFile,
  onKeepInSync,
  busy = false,
  creating = false,
  failure = null,
}: {
  group: DuplicateGroup;
  home: string | null;
  onOpenFile: (file: FileRow) => void;
  /** Absent once the copies are tracked by a sync group. */
  onKeepInSync?: () => void;
  busy?: boolean;
  creating?: boolean;
  failure?: string | null;
}) {
  const titleId = useId();
  const first = group.files.at(0);
  if (!first) {
    return null;
  }

  return (
    <Card aria-labelledby={titleId} role="group" size="sm">
      <CardHeader className="flex items-center gap-3">
        <FileKindIcon
          className="size-4 shrink-0 text-muted-foreground"
          kind={first.kind}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* biome-ignore lint/a11y/useHeadingContent: the title's children become the heading's content */}
          <CardTitle className="truncate" id={titleId} render={<h2 />}>
            {fileTitle(first)}
          </CardTitle>
          <CardDescription>{kindSummary(group.files)}</CardDescription>
        </div>
        {onKeepInSync ? (
          <Button
            aria-describedby={titleId}
            disabled={busy}
            onClick={onKeepInSync}
            size="sm"
            variant="surface"
          >
            {creating ? <Spinner /> : null}
            Keep in sync
          </Button>
        ) : (
          <Badge color="green">
            <Check aria-hidden="true" />
            Kept in sync
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ItemGroup aria-labelledby={titleId}>
          {group.files.map((file) => (
            <CopyRow
              file={file}
              home={home}
              key={file.id}
              onOpenFile={onOpenFile}
            />
          ))}
        </ItemGroup>
        {failure ? (
          <Text as="p" role="alert" tone="destructive">
            {failure}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CopyRow({
  file,
  home,
  onOpenFile,
}: {
  file: FileRow;
  home: string | null;
  onOpenFile: (file: FileRow) => void;
}) {
  const pathId = useId();
  return (
    <Item role="listitem" style={ROW_STYLE}>
      <ItemContent>
        <Text
          as="div"
          className="truncate"
          id={pathId}
          mono
          size="label"
          title={file.path}
        >
          {displayPath(file.path, home)}
        </Text>
        {file.aliases.map((alias) => (
          <Text
            as="div"
            className="flex min-w-0 items-center gap-1"
            key={alias}
            mono
            size="caption"
            title={alias}
            tone="muted"
          >
            <Link2 aria-hidden="true" className="size-3 shrink-0" />
            <span className="sr-only">Symlink: </span>
            <span className="truncate">{displayPath(alias, home)}</span>
          </Text>
        ))}
      </ItemContent>
      <ItemActions>
        <IconButton
          aria-describedby={pathId}
          label="Open in Library"
          onClick={() => onOpenFile(file)}
        >
          <ArrowUpRight />
        </IconButton>
      </ItemActions>
    </Item>
  );
}
