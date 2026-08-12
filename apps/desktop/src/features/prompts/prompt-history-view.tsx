import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, Copy, Folder, FolderOpen, Search, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { createPrompt, listPromptHistory, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PromptHistoryView() {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [content, setContent] = useState("");
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimerRef = useRef<number | undefined>(undefined);

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
  const historyReady = !loading && error === null;

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
      const created = await createPrompt(content, destinationPath);
      setEntries((current) => [created, ...current]);
      setContent("");
      setDestinationPath(null);
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

  const handleCopy = async (entry: PromptHistoryEntry) => {
    try {
      await writeText(entry.content);
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
        <header className="border-border border-b px-6 py-5">
          <h1 className="font-semibold text-lg">Prompt history</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Stored locally, available with or without a connection.
          </p>
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
              placeholder="Write the prompt you want to use later…"
              ref={textareaRef}
              value={content}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-sm">Destination folder</span>
              <span className="text-muted-foreground text-xs">Optional</span>
            </div>
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
              onChange={(event) => setSearch(event.target.value)}
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
              <Button onClick={refresh} size="sm" variant="outline">
                Try again
              </Button>
            </div>
          ) : null}

          {historyReady && visibleEntries.length === 0 ? (
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

          {historyReady ? (
            <ol>
              {visibleEntries.map((entry) => (
                <li className="border-border border-b px-6 py-5" key={entry.id}>
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
                            <span className="truncate">
                              {entry.destinationPath}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <Button
                        aria-label={`Copy prompt saved ${DATE_TIME_FORMATTER.format(entry.createdAt)}`}
                        onClick={async () => {
                          await handleCopy(entry);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        {copiedId === entry.id ? <Check /> : <Copy />}
                        {copiedId === entry.id ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-foreground/90 text-sm leading-6">
                      {entry.content}
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>
    </div>
  );
}
