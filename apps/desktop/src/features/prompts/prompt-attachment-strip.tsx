import { Reveal, RevealScope } from "@ctrl-ui/react/ui/reveal";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Check, Copy, ImageIcon, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

import type { PromptAttachment } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";
import { attachmentDataUrl, copyAttachmentImage } from "./prompt-attachments";
import { useCopyFeedback } from "./use-copy-feedback";

export function PromptAttachmentStrip({
  attachments,
}: {
  attachments: PromptAttachment[];
}) {
  return (
    <ul aria-label="Attached images" className="flex flex-wrap gap-2">
      {attachments.map((attachment, index) => (
        <RevealScope
          key={attachment.id}
          render={
            <li className="relative size-16 overflow-hidden rounded-md bg-muted" />
          }
        >
          <AttachmentPreview attachment={attachment} index={index} />
          <Reveal className="absolute end-1 bottom-1 flex">
            <CopyAttachmentButton attachment={attachment} index={index} />
          </Reveal>
        </RevealScope>
      ))}
    </ul>
  );
}

function CopyAttachmentButton({
  attachment,
  index,
}: {
  attachment: PromptAttachment;
  index: number;
}) {
  const [copied, markCopied] = useCopyFeedback();

  const copy = async () => {
    try {
      await copyAttachmentImage(attachment);
      markCopied();
    } catch {
      toast.error("Could not copy the image");
    }
  };

  return (
    <IconButton
      label={copied ? "Copied" : `Copy image ${index + 1}`}
      onClick={copy}
      size="xs"
      variant="scrim"
    >
      {copied ? <Check /> : <Copy />}
    </IconButton>
  );
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "failed" };

function AttachmentPreview({
  attachment,
  index,
}: {
  attachment: PromptAttachment;
  index: number;
}) {
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    attachmentDataUrl(attachment)
      .then((url) => {
        objectUrl = url;
        if (active) {
          setPreview({ status: "ready", url });
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (active) {
          setPreview({ status: "failed" });
        }
      });
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment]);

  if (preview.status === "ready") {
    return (
      // biome-ignore lint/performance/noImgElement: Tauri renders local attachment previews.
      <img
        alt={`Attachment ${index + 1}`}
        className="size-full object-cover"
        height={attachment.height}
        src={preview.url}
        width={attachment.width}
      />
    );
  }

  if (preview.status === "failed") {
    return (
      <span className="flex size-full items-center justify-center text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-4" />
        <span className="sr-only">Image {index + 1} could not be loaded</span>
      </span>
    );
  }

  return (
    <span className="flex size-full items-center justify-center text-muted-foreground">
      <ImageIcon aria-hidden="true" className="size-4" />
    </span>
  );
}
