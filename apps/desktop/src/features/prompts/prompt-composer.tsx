import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { ClipboardPaste, Folder, FolderOpen, Star, X } from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useFavoriteProjects } from "@/features/projects/use-favorite-projects";
import { createPrompt, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { CaptureShortcut } from "./capture-shortcut";
import {
  type DraftPromptImage,
  draftImageFromClipboard,
  MAX_PROMPT_IMAGES,
} from "./prompt-attachments";

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
  const favoriteProjects = useFavoriteProjects();

  const handleChooseFolder = async () => {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "Choose a destination folder",
    });
    if (typeof picked === "string") {
      setDestinationPath(picked);
    }
  };

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
      setDestinationPath(null);
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

      <form
        className="flex min-h-0 flex-1 flex-col gap-5 p-6"
        onSubmit={handleSave}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <label className="font-medium text-sm" htmlFor="prompt-content">
            New prompt
          </label>
          <textarea
            className="min-h-48 flex-1 resize-none rounded-xl border border-input bg-transparent px-4 py-3 text-sm leading-6 outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={saving}
            id="prompt-content"
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            onPaste={handlePaste}
            placeholder="Write the prompt you want to use later…"
            ref={textareaRef}
            value={content}
          />
          <div className="flex items-center justify-end gap-3">
            <span className="text-muted-foreground text-xs">
              {draftImages.length}/{MAX_PROMPT_IMAGES} images
            </span>
            <Button
              disabled={saving || draftImages.length >= MAX_PROMPT_IMAGES}
              onClick={addClipboardImage}
              size="sm"
              type="button"
              variant="outline"
            >
              <ClipboardPaste />
              Paste image
            </Button>
          </div>
          <DraftAttachmentStrip
            images={draftImages}
            onRemove={(id) =>
              setDraftImages((current) =>
                current.filter((candidate) => candidate.id !== id)
              )
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-sm">Destination folder</span>
            <span className="text-muted-foreground text-xs">Optional</span>
          </div>
          {favoriteProjects.favorites.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {favoriteProjects.favorites.map((project) => (
                <button
                  aria-pressed={destinationPath === project.path}
                  className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-muted px-3 text-sm transition-colors hover:bg-accent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  key={project.path}
                  onClick={() => setDestinationPath(project.path)}
                  title={project.path}
                  type="button"
                >
                  <Star className="size-3 fill-current" />
                  <span className="truncate">
                    {project.path.split("/").at(-1) ?? project.path}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/60 p-2">
            <Folder className="ml-1 size-4 shrink-0 text-muted-foreground" />
            <span
              className="min-w-0 flex-1 truncate text-muted-foreground text-sm"
              title={destinationPath ?? undefined}
            >
              {destinationPath ?? "No folder selected"}
            </span>
            <Button
              disabled={saving}
              onClick={handleChooseFolder}
              size="sm"
              type="button"
              variant="outline"
            >
              <FolderOpen />
              {destinationPath ? "Change" : "Choose"}
            </Button>
            {destinationPath ? (
              <Button
                aria-label="Clear destination folder"
                disabled={saving}
                onClick={() => setDestinationPath(null)}
                size="icon-sm"
                title="Clear destination folder"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-xs">
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to save
          </span>
          <Button
            disabled={saving || content.trim().length === 0}
            type="submit"
          >
            {saving ? "Saving…" : "Save prompt"}
          </Button>
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
    <div className="flex gap-2 overflow-x-auto pb-1">
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
