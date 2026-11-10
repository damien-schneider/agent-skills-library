import { Alert, AlertDescription, AlertTitle } from "@ctrl-ui/react/ui/alert";
import { Badge, type BadgeColor } from "@ctrl-ui/react/ui/badge";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ctrl-ui/react/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
} from "@ctrl-ui/react/ui/item";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { ArrowUpRight, CircleAlert, Trash2, Unlink } from "lucide-react";
import { useId, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { addMembers, removeMember, setCanonical, toIpcError } from "@/lib/ipc";
import type {
  FileRow,
  MemberStatus,
  SyncGroupView,
  SyncMemberView,
} from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";

import { notifySyncGroupsChanged } from "./sync-events";

const UNDO_TOAST_MS = 8000;

const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-padding-block": "calc(var(--spacing) * 1)",
} as const;

interface StatusBadge {
  label: string;
  color: BadgeColor;
}

const MEMBER_STATUS: Record<MemberStatus, StatusBadge> = {
  "in-sync": { label: "In sync", color: "neutral" },
  symlinked: { label: "Linked to source", color: "neutral" },
  drifted: { label: "Out of sync", color: "orange" },
  missing: { label: "Missing", color: "red" },
};

function needsSync(member: SyncMemberView): boolean {
  return member.status === "drifted" || member.status === "missing";
}

function groupStatus(group: SyncGroupView): StatusBadge {
  if (!group.canonical) {
    return { label: "No source", color: "red" };
  }
  if (group.members.length === 0) {
    return { label: "No other file", color: "neutral" };
  }
  const stale = group.members.filter(needsSync).length;
  return stale === 0
    ? { label: "In sync", color: "green" }
    : { label: `${stale} out of sync`, color: "orange" };
}

export function SyncGroupCard({
  group,
  home,
  onOpenFile,
  onReview,
  onRemove,
}: {
  group: SyncGroupView;
  home: string | null;
  onOpenFile: (file: FileRow) => void;
  onReview: () => void;
  onRemove: () => void;
}) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = groupStatus(group);
  const source = group.canonical;
  const canReview = source !== null && group.members.length > 0;
  const hasStaleFiles = group.members.some(needsSync);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setBusy(false);
      notifySyncGroupsChanged();
    }
  };

  // The backend only swaps the source pointer; without the second call the
  // former source would silently leave the group.
  const makeSource = (member: SyncMemberView) =>
    run(async () => {
      await setCanonical(group.id, member.file.id);
      if (source) {
        await addMembers(group.id, [source.id], member.strategy);
      }
    });

  const restoreMember = async (member: SyncMemberView) => {
    try {
      await addMembers(group.id, [member.file.id], member.strategy);
    } catch (cause) {
      toast.error("The file could not be added back", {
        description: toIpcError(cause).message,
      });
    } finally {
      notifySyncGroupsChanged();
    }
  };

  const dropMember = (member: SyncMemberView) =>
    run(async () => {
      await removeMember(group.id, member.file.id);
      const id = toast(`Removed from “${group.name}”`, {
        description: displayPath(member.file.path, home),
        timeout: UNDO_TOAST_MS,
        actionProps: {
          children: "Undo",
          onClick: () => {
            toast.dismiss(id);
            restoreMember(member);
          },
        },
      });
    });

  return (
    <Card aria-labelledby={titleId} role="group" size="sm">
      <CardHeader className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* biome-ignore lint/a11y/useHeadingContent: the title's children become the heading's content */}
          <CardTitle className="truncate" id={titleId} render={<h2 />}>
            {group.name}
          </CardTitle>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
        <Button
          aria-describedby={titleId}
          disabled={!canReview}
          onClick={onReview}
          size="sm"
          tone={hasStaleFiles ? "primary" : "neutral"}
          variant={hasStaleFiles ? "solid" : "surface"}
        >
          Review &amp; apply
        </Button>
        <IconButton
          aria-describedby={titleId}
          label="Remove group"
          onClick={onRemove}
        >
          <Trash2 />
        </IconButton>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ItemGroup aria-labelledby={titleId}>
          {source ? (
            <FileRowItem
              file={source}
              home={home}
              onOpenFile={onOpenFile}
              status={{ label: "Source", color: "primary" }}
            />
          ) : null}
          {group.members.map((member) => (
            <FileRowItem
              canOpen={member.status !== "missing"}
              file={member.file}
              home={home}
              key={member.file.id}
              memberActions={{
                busy,
                onMakeSource: () => {
                  makeSource(member);
                },
                onRemove: () => {
                  dropMember(member);
                },
              }}
              onOpenFile={onOpenFile}
              status={MEMBER_STATUS[member.status]}
            />
          ))}
        </ItemGroup>

        {source ? null : (
          <Text as="p" tone="muted">
            The source file is gone. Make another file the source to keep this
            group in sync.
          </Text>
        )}

        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>The group was not changed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FileRowItem({
  file,
  home,
  status,
  memberActions,
  canOpen = true,
  onOpenFile,
}: {
  file: FileRow;
  home: string | null;
  status: StatusBadge;
  /** Only a member can be promoted or removed; the source has neither. */
  memberActions?: {
    busy: boolean;
    onMakeSource: () => void;
    onRemove: () => void;
  };
  canOpen?: boolean;
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
      </ItemContent>
      {memberActions ? (
        <ItemActions showOnHover>
          <Button
            aria-describedby={pathId}
            disabled={memberActions.busy}
            onClick={memberActions.onMakeSource}
            size="sm"
            variant="ghost"
          >
            Make source
          </Button>
          <IconButton
            aria-describedby={pathId}
            disabled={memberActions.busy}
            label="Remove from group"
            onClick={memberActions.onRemove}
          >
            <Unlink />
          </IconButton>
        </ItemActions>
      ) : null}
      <Badge color={status.color}>{status.label}</Badge>
      <ItemActions>
        <IconButton
          aria-describedby={pathId}
          disabled={!canOpen}
          label="Open in Library"
          onClick={() => onOpenFile(file)}
        >
          <ArrowUpRight />
        </IconButton>
      </ItemActions>
    </Item>
  );
}
