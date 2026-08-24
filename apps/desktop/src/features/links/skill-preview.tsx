import { PreviewCard } from "@base-ui/react/preview-card";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { ArrowUpRight } from "lucide-react";
import type { ComponentProps, ReactElement } from "react";

import type { FileRow } from "@/lib/ipc-types";

import { linkLabel } from "./link-label";
import { useSkillPreview } from "./use-skill-preview";

const POPUP_CLASS =
  "z-50 w-80 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none";

function PreviewBody({
  file,
  onOpen,
}: {
  file: FileRow;
  onOpen: (file: FileRow) => void;
}) {
  const preview = useSkillPreview(file);

  return (
    <div className="flex flex-col gap-2">
      <button
        className="group flex items-start gap-1.5 text-left font-medium text-sm hover:underline"
        onClick={() => onOpen(file)}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{linkLabel(file)}</span>
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
      </button>

      <p className="line-clamp-4 text-muted-foreground text-xs leading-5">
        {preview?.description || preview?.excerpt || "…"}
      </p>

      <p className="truncate text-[11px] text-muted-foreground/70">
        {targetLabel(file.kind)} · {file.path}
      </p>
    </div>
  );
}

export function SkillPreviewCard({
  anchor,
  file,
  onOpen,
  onOpenChange,
  open,
  popupProps,
}: {
  anchor: Element | null;
  file: FileRow;
  onOpen: (file: FileRow) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  popupProps?: Pick<ComponentProps<"div">, "onPointerEnter" | "onPointerLeave">;
}) {
  return (
    <PreviewCard.Root onOpenChange={onOpenChange} open={open}>
      <PreviewCard.Portal>
        <PreviewCard.Positioner anchor={anchor} sideOffset={8}>
          <PreviewCard.Popup className={POPUP_CLASS} {...popupProps}>
            <PreviewBody file={file} onOpen={onOpen} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
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
    <PreviewCard.Root>
      <PreviewCard.Trigger render={children} />
      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={8}>
          <PreviewCard.Popup className={POPUP_CLASS}>
            <PreviewBody file={file} onOpen={onOpen} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
