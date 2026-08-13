import { readImage, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Check,
  ClipboardPaste,
  Copy,
  Folder,
  FolderOpen,
  ImageIcon,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useFavoriteProjects } from "@/features/projects/use-favorite-projects";
import { onCaptureSaved } from "@/lib/events";
import { createPrompt, listPromptHistory, toIpcError } from "@/lib/ipc";
import type { PromptAttachment, PromptHistoryEntry } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { CaptureShortcut } from "./capture-shortcut";
import {
  attachmentDataUrl,
  claudeCodePrompt,
  copyAttachmentImage,
  type DraftPromptImage,
  draftImageFromClipboard,
  MAX_PROMPT_IMAGES,
} from "./prompt-attachments";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PromptHistoryView() {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [content, setContent] = useState("");
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [draftImages, setDraftImages] = useState<DraftPromptImage[]>([]);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimerRef = useRef<number | undefined>(undefined);
  const favoriteProjects = useFavoriteProjects();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await listPromptHistory());
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
    const unlisten = onCaptureSaved((captured) => {
      setEntries((current) => [
        captured,
        ...current.filter((entry) => entry.id !== captured.id),
      ]);
    }).catch(() => undefined);
    return () => {
      unlisten.then((stop) => stop?.()).catch(() => undefined);
    };
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(copiedTimerRef.current);
    },
    []
  );

  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) {
      return entries;
    }
    return entries.filter(
      (entry) =>
        entry.content.toLowerCase().includes(needle) ||
        entry.destinationPath?.toLowerCase().includes(needle)
    );
  }, [entries, search]);

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
      setEntries((current) => [created, ...current]);
      setContent("");
      setDestinationPath(null);
      setDraftImages([]);
      setError(null);
      textareaRef.current?.focus();
    } catch (cause) {
      toast.error(toIpcError(cause).message);
    } finally {
      setSaving(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
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

  const handleCopy = async (entry: PromptHistoryEntry) => {
    try {
      await writeText(claudeCodePrompt(entry));
      setCopiedId(entry.id);
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error("Could not copy the prompt");
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(360px,44%)_1fr]">
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

      <PromptHistoryList
        copiedId={copiedId}
        entries={entries}
        error={error}
        loading={loading}
        onCopy={handleCopy}
        onRefresh={refresh}
        onSearch={setSearch}
        search={search}
        visibleEntries={visibleEntries}
      />
    </div>
  );
}

function PromptHistoryList({
  copiedId,
  entries,
  error,
  loading,
  onCopy,
  onRefresh,
  onSearch,
  search,
  visibleEntries,
}: {
  copiedId: number | null;
  entries: PromptHistoryEntry[];
  error: string | null;
  loading: boolean;
  onCopy: (entry: PromptHistoryEntry) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSearch: (search: string) => void;
  search: string;
  visibleEntries: PromptHistoryEntry[];
}) {
  const ready = !loading && error === null;
  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex items-center gap-4 border-border border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base">History</h2>
          <p className="text-muted-foreground text-xs">
            {entries.length} {entries.length === 1 ? "prompt" : "prompts"}
          </p>
        </div>
        <div className="relative w-full max-w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search prompt history"
            className="h-8 pl-8"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search prompts and folders"
            value={search}
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <p className="px-6 py-10 text-muted-foreground text-sm">
            Loading history…
          </p>
        ) : null}
        {!loading && error ? (
          <div className="flex items-center justify-between gap-4 px-6 py-10">
            <p className="text-destructive text-sm">{error}</p>
            <Button onClick={onRefresh} size="sm" variant="outline">
              Try again
            </Button>
          </div>
        ) : null}
        {ready && visibleEntries.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-20 text-center">
            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-muted">
              <Copy className="size-4 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm">
              {entries.length === 0
                ? "No saved prompts yet"
                : "No prompts found"}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              {entries.length === 0
                ? "Write a prompt on the left to keep it ready for later."
                : "Try a different search term."}
            </p>
          </div>
        ) : null}
        {ready ? (
          <ol>
            {visibleEntries.map((entry) => (
              <PromptHistoryItem
                copied={copiedId === entry.id}
                entry={entry}
                key={entry.id}
                onCopy={onCopy}
              />
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function PromptHistoryItem({
  copied,
  entry,
  onCopy,
}: {
  copied: boolean;
  entry: PromptHistoryEntry;
  onCopy: (entry: PromptHistoryEntry) => Promise<void>;
}) {
  return (
    <li className="group border-border border-b px-6 py-5 transition-colors hover:bg-muted/25">
      <article>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <time
              className="block text-muted-foreground text-xs"
              dateTime={new Date(entry.createdAt).toISOString()}
            >
              {DATE_TIME_FORMATTER.format(entry.createdAt)}
            </time>
            {entry.destinationPath ? (
              <div
                className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs"
                title={entry.destinationPath}
              >
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{entry.destinationPath}</span>
              </div>
            ) : null}
          </div>
          <Button
            aria-label={`Copy prompt saved ${DATE_TIME_FORMATTER.format(entry.createdAt)}`}
            className="opacity-70 group-focus-within:opacity-100 group-hover:opacity-100"
            onClick={() => onCopy(entry)}
            size="sm"
            variant="outline"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {entry.attachments.length > 0 ? (
          <AttachmentStrip attachments={entry.attachments} />
        ) : null}
        <p className="whitespace-pre-wrap break-words text-foreground/90 text-sm leading-6">
          {entry.content}
        </p>
      </article>
    </li>
  );
}

function CopyAttachmentButton({
  attachment,
  index,
}: {
  attachment: PromptAttachment;
  index: number;
}) {
  return (
    <button
      aria-label={`Copy saved attachment ${index + 1}`}
      className="absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full bg-background/90 opacity-0 shadow-sm transition-opacity hover:bg-background focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
      onClick={async () => {
        try {
          await copyAttachmentImage(attachment);
        } catch {
          toast.error("Could not copy the attached image");
        }
      }}
      type="button"
    >
      <Copy className="size-3.5" />
    </button>
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

function AttachmentStrip({ attachments }: { attachments: PromptAttachment[] }) {
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto">
      {attachments.map((attachment, index) => (
        <div
          className="group relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted"
          key={attachment.id}
        >
          <PromptAttachmentPreview attachment={attachment} index={index} />
          <CopyAttachmentButton attachment={attachment} index={index} />
        </div>
      ))}
    </div>
  );
}

function PromptAttachmentPreview({
  attachment,
  index,
}: {
  attachment: PromptAttachment;
  index: number;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    attachmentDataUrl(attachment)
      .then((url) => {
        objectUrl = url;
        if (active) {
          setPreviewUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (active) {
          toast.error("Could not load a saved image");
        }
      });
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment]);

  return (
    <>
      {previewUrl ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: Tauri renders local attachment previews. */}
          <img
            alt={`Saved attachment ${index + 1}`}
            className="size-full object-cover"
            height={attachment.height}
            src={previewUrl}
            width={attachment.width}
          />
        </>
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageIcon className="size-4 text-muted-foreground" />
        </div>
      )}
    </>
  );
}
