import { Button } from "@ctrl-ui/react/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrl-ui/react/ui/hover-card";
import { Text } from "@ctrl-ui/react/ui/typography";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import type { ComponentProps, ReactElement } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { useHomeDirectory } from "@/lib/home-dir";
import type { FileRow } from "@/lib/ipc-types";

import { linkLabel } from "./link-label";

function PreviewBody({
  file,
  onOpen,
}: {
  file: FileRow;
  onOpen: (file: FileRow) => void;
}) {
  const home = useHomeDirectory();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <Text className="min-w-0 flex-1 truncate" size="label" weight="medium">
          {linkLabel(file)}
        </Text>
        <Text size="caption" tone="muted">
          {targetLabel(file.kind)}
        </Text>
      </div>
      {file.description ? (
        <Text className="line-clamp-4" size="caption" tone="muted">
          {file.description}
        </Text>
      ) : null}
      <Text className="truncate" mono size="micro" tone="muted">
        {displayPath(file.path, home)}
      </Text>
      <Button
        className="self-start"
        onClick={() => onOpen(file)}
        size="xs"
        variant="surface"
      >
        Open
      </Button>
    </div>
  );
}

/** A preview for a hover target React does not render, such as a mention inside the editor. */
export function SkillPreviewCard({
  anchor,
  file,
  onOpen,
  onOpenChange,
  popupProps,
}: {
  anchor: Element;
  file: FileRow;
  onOpen: (file: FileRow) => void;
  onOpenChange: (open: boolean) => void;
  popupProps?: Pick<ComponentProps<"div">, "onPointerEnter" | "onPointerLeave">;
}) {
  return (
    <HoverCard onOpenChange={onOpenChange} open>
      <HoverCardContent
        align="start"
        anchor={anchor}
        className="w-80"
        {...popupProps}
      >
        <PreviewBody file={file} onOpen={onOpen} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function SkillPreviewTrigger({
  children,
  file,
  onOpen,
}: {
  children: ReactElement;
  file: FileRow;
  onOpen: (file: FileRow) => void;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger render={children} />
      <HoverCardContent align="start" className="w-80">
        <PreviewBody file={file} onOpen={onOpen} />
      </HoverCardContent>
    </HoverCard>
  );
}
