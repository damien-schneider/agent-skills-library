import {
  Check,
  Copy,
  Folder,
  ImageIcon,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { destinationParts } from "@/features/destinations/destination-path";
import { useHomeDirectory } from "@/lib/home-dir";
import type { PromptAttachment, PromptHistoryEntry } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { attachmentDataUrl, copyAttachmentImage } from "./prompt-attachments";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PromptHistoryList({
  copiedId,
  entries,
  deletingId,
  error,
  loading,
  onCopy,
  onDelete,
  onDeleteRequest,
  onRefresh,
  onSearch,
  pendingDeleteId,
  search,
  visibleEntries,
}: {
  copiedId: number | null;
  deletingId: number | null;
  entries: PromptHistoryEntry[];
  error: string | null;
  loading: boolean;
  onCopy: (entry: PromptHistoryEntry) => Promise<void>;
  onDelete: (entry: PromptHistoryEntry) => Promise<void>;
  onDeleteRequest: (id: number | null) => void;
  onRefresh: () => Promise<void>;
  onSearch: (search: string) => void;
  pendingDeleteId: number | null;
  search: string;
  visibleEntries: PromptHistoryEntry[];
}) {
  const home = useHomeDirectory();
  const ready = !loading && error === null;
  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex items-center gap-4 border-border border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-base">History</h2>
          <p className="text-muted-foreground text-xs">
            {search.trim().length > 0
              ? `${visibleEntries.length} of ${entries.length}`
              : entries.length}{" "}
            {entries.length === 1 ? "prompt" : "prompts"}
          </p>
        </div>
        <div className="relative w-full max-w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search prompt history"
            className="h-8 pr-8 pl-8"
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search.length > 0) {
                event.preventDefault();
                onSearch("");
              }
            }}
            placeholder="Search prompts and folders"
            value={search}
          />
          {search.length > 0 ? (
            <button
              aria-label="Clear history search"
              className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              onClick={() => onSearch("")}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
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
                deleteDisabled={deletingId !== null}
                deleting={deletingId === entry.id}
                entry={entry}
                home={home}
                key={entry.id}
                onCopy={onCopy}
                onDelete={onDelete}
                onDeleteRequest={onDeleteRequest}
                pendingDelete={pendingDeleteId === entry.id}
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
  deleteDisabled,
  deleting,
  entry,
  home,
  onCopy,
  onDelete,
  onDeleteRequest,
  pendingDelete,
}: {
  copied: boolean;
  deleteDisabled: boolean;
  deleting: boolean;
  entry: PromptHistoryEntry;
  home: string | null;
  onCopy: (entry: PromptHistoryEntry) => Promise<void>;
  onDelete: (entry: PromptHistoryEntry) => Promise<void>;
  onDeleteRequest: (id: number | null) => void;
  pendingDelete: boolean;
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
              <DestinationLabel home={home} path={entry.destinationPath} />
            ) : null}
          </div>
          {pendingDelete ? (
            <fieldset className="flex items-center gap-1.5">
              <legend className="sr-only">Confirm prompt deletion</legend>
              <Button
                disabled={deleting}
                onClick={() => onDeleteRequest(null)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={deleting}
                onClick={() => onDelete(entry)}
                size="sm"
                variant="destructive"
              >
                <Trash2 />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </fieldset>
          ) : (
            <div className="flex items-center gap-1 opacity-70 group-focus-within:opacity-100 group-hover:opacity-100">
              <Button
                aria-label={`Copy prompt saved ${DATE_TIME_FORMATTER.format(entry.createdAt)}`}
                onClick={() => onCopy(entry)}
                size="sm"
                variant="outline"
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                aria-label={`Delete prompt saved ${DATE_TIME_FORMATTER.format(entry.createdAt)}`}
                disabled={deleteDisabled}
                onClick={() => onDeleteRequest(entry.id)}
                size="icon-sm"
                title="Delete prompt"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </div>
          )}
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

function DestinationLabel({
  home,
  path,
}: {
  home: string | null;
  path: string;
}) {
  const { name, parent } = destinationParts(path, home);
  return (
    <div
      className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs"
      title={path}
    >
      <Folder className="size-3 shrink-0" />
      <span className="truncate">{parent}</span>
      <span className="shrink-0 font-medium text-foreground/80">{name}</span>
    </div>
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

  return previewUrl ? (
    // biome-ignore lint/performance/noImgElement: Tauri renders local attachment previews.
    <img
      alt={`Saved attachment ${index + 1}`}
      className="size-full object-cover"
      height={attachment.height}
      src={previewUrl}
      width={attachment.width}
    />
  ) : (
    <div className="flex size-full items-center justify-center">
      <ImageIcon className="size-4 text-muted-foreground" />
    </div>
  );
}
