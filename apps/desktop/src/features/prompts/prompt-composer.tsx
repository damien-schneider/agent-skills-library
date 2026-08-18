import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { ImagePlus, X } from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { DestinationPicker } from "@/features/destinations/destination-picker";
import { createPrompt, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { CaptureShortcut } from "./capture-shortcut";
import {
  type DraftPromptImage,
  draftImageFromClipboard,
  MAX_PROMPT_IMAGES,
} from "./prompt-attachments";

const SAVE_SHORTCUT = navigator.platform.includes("Mac") ? "⌘↩" : "Ctrl+↩";

function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

export function PromptComposer({
  onCreated,
}: {
  onCreated: (entry: PromptHistoryEntry) => void;
}) {
  const [content, setContent] = useState("");
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [draftImages, setDraftImages] = useState<DraftPromptImage[]>([]);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (content.trim().length === 0) {
      return;
    }

    setSaving(true);
    try {
      const created = await createPrompt(
        content,
        destinationPath,
        draftImages.map(({ rgba, width, height }) => ({ rgba, width, height }))
      );
      onCreated(created);
      setContent("");
      setDraftImages([]);
      textareaRef.current?.focus();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    } finally {
      setSaving(false);
    }
  };

  const addClipboardImage = async () => {
    if (draftImages.length >= MAX_PROMPT_IMAGES) {
      toast.error(`A prompt can have at most ${MAX_PROMPT_IMAGES} images`);
      return;
    }
    try {
      const image = await draftImageFromClipboard(await readImage());
      setDraftImages((current) => [...current, image]);
    } catch {
      toast.error("The clipboard does not contain an image");
    }
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const containsImage = [...event.clipboardData.items].some((item) =>
      item.type.startsWith("image/")
    );
    if (containsImage) {
      event.preventDefault();
      await addClipboardImage();
    }
  };

  return (
    <section className="flex min-h-0 flex-col border-border border-r">
      <header className="flex items-center justify-between gap-4 border-border border-b px-6 py-5">
        <div>
          <h1 className="font-semibold text-lg">Prompt history</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Stored locally, available with or without a connection.
          </p>
        </div>
        <CaptureShortcut />
      </header>

      <form className="flex min-h-0 flex-1 flex-col p-6" onSubmit={handleSave}>
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-input transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <label className="sr-only" htmlFor="prompt-content">
            New prompt
          </label>
          <textarea
            className="min-h-40 flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            id="prompt-content"
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            onPaste={handlePaste}
            placeholder="Write the prompt you want to use later…"
            ref={textareaRef}
            value={content}
          />

          <DraftAttachmentStrip
            images={draftImages}
            onRemove={(id) =>
              setDraftImages((current) =>
                current.filter((candidate) => candidate.id !== id)
              )
            }
          />

          <div className="flex items-center gap-2 border-border border-t p-2">
            <DestinationPicker
              disabled={saving}
              onChange={setDestinationPath}
              value={destinationPath}
            />
            <Button
              aria-label="Paste image from clipboard"
              disabled={saving || draftImages.length >= MAX_PROMPT_IMAGES}
              onClick={addClipboardImage}
              size="sm"
              title={
                draftImages.length >= MAX_PROMPT_IMAGES
                  ? `A prompt can have at most ${MAX_PROMPT_IMAGES} images`
                  : "Paste image from clipboard"
              }
              type="button"
              variant="ghost"
            >
              <ImagePlus />
              {draftImages.length > 0 ? (
                <span className="text-xs">
                  {draftImages.length}/{MAX_PROMPT_IMAGES}
                </span>
              ) : null}
            </Button>
            <div className="ml-auto flex items-center gap-3">
              {content.trim().length > 0 ? (
                <span className="text-muted-foreground text-xs">
                  {SAVE_SHORTCUT}
                </span>
              ) : null}
              <Button
                disabled={saving || content.trim().length === 0}
                size="sm"
                type="submit"
              >
                {saving ? "Saving…" : "Save prompt"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

function DraftAttachmentStrip({
  images,
  onRemove,
}: {
  images: DraftPromptImage[];
  onRemove: (id: string) => void;
}) {
  if (images.length === 0) {
    return null;
  }
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3">
      {images.map((image, index) => (
        <div
          className="group relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
          key={image.id}
        >
          {/* biome-ignore lint/performance/noImgElement: Tauri renders local clipboard previews. */}
          <img
            alt={`Draft attachment ${index + 1}`}
            className="size-full object-cover"
            height={image.height}
            src={image.previewUrl}
            width={image.width}
          />
          <button
            aria-label={`Remove draft attachment ${index + 1}`}
            className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-background/90 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={() => onRemove(image.id)}
            type="button"
          >
            <X />
          </button>
        </div>
      ))}
    </div>
  );
}
