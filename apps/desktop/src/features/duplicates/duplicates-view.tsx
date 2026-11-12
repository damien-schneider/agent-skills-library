import { toast } from "@ctrl-ui/react/ui/toast";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CopyCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { displayPath } from "@/features/destinations/destination-path";
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
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  ViewLayout,
} from "@/shared/components/view-layout";

import { DuplicateCard } from "./duplicate-card";

/** A collapsed card with its first copies; the real height is measured once rendered. */
const ESTIMATED_CARD_HEIGHT = 220;
const CARDS_RENDERED_OFFSCREEN = 3;
/** Matches the `gap-5` between the page's sections. */
const CARD_GAP = 20;

interface ListedGroup {
  group: DuplicateGroup;
  /** Copies already tracked together need no decision: one sync group holds them all. */
  keptInSync: boolean;
}

/** Groups still waiting for a decision come before the ones already handled. */
function listGroups(
  groups: DuplicateGroup[],
  syncGroups: SyncGroupView[]
): ListedGroup[] {
  const trackedSets = syncGroups.map((syncGroup) => {
    const tracked = new Set(syncGroup.members.map((member) => member.file.id));
    if (syncGroup.canonicalFileId !== null) {
      tracked.add(syncGroup.canonicalFileId);
    }
    return tracked;
  });
  const listed = groups.map((group) => ({
    group,
    keptInSync: trackedSets.some((tracked) =>
      group.files.every((file) => tracked.has(file.id))
    ),
  }));
  return [
    ...listed.filter((item) => !item.keptInSync),
    ...listed.filter((item) => item.keptInSync),
  ];
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

  const listed = useMemo(
    () => listGroups(groups, syncGroups),
    [groups, syncGroups]
  );
  const isEmpty = !(loading || error) && groups.length === 0;

  // Only the cards in view are mounted: a big library holds hundreds of groups
  // and thousands of copies, which froze the view when rendered at once.
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listOffset, setListOffset] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const virtualizer = useVirtualizer({
    count: listed.length,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    gap: CARD_GAP,
    getItemKey: (index) => listed[index]?.group.hash ?? index,
    getScrollElement: () => viewportRef.current,
    overscan: CARDS_RENDERED_OFFSCREEN,
    scrollMargin: listOffset,
  });

  // The list starts below the page header and anything shown above it.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!(viewport && list)) {
      return;
    }
    setListOffset(
      list.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top +
        viewport.scrollTop
    );
  });

  const toggleExpanded = useCallback((hash: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(hash)) {
        next.add(hash);
      }
      return next;
    });
  }, []);

  return (
    <ViewLayout
      description="Keep in sync tracks identical copies as one group in Sync, with the top copy as the source. Nothing on disk changes until you apply a sync there."
      scrollViewportRef={viewportRef}
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

      {listed.length > 0 ? (
        <div
          className="relative w-full shrink-0"
          ref={listRef}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const item = listed[row.index];
            if (!item) {
              return null;
            }
            const { group, keptInSync } = item;
            return (
              <div
                className="absolute inset-x-0 top-0"
                data-index={row.index}
                key={row.key}
                ref={virtualizer.measureElement}
                style={{
                  transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <DuplicateCard
                  busy={creatingHash !== null}
                  creating={creatingHash === group.hash}
                  expanded={expanded.has(group.hash)}
                  failure={
                    failure?.hash === group.hash ? failure.message : null
                  }
                  group={group}
                  home={home}
                  onKeepInSync={
                    keptInSync
                      ? undefined
                      : () => {
                          keepInSync(group);
                        }
                  }
                  onOpenFile={onOpenFile}
                  onToggleExpanded={() => toggleExpanded(group.hash)}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </ViewLayout>
  );
}
