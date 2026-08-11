import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FolderOpen,
  Link2,
  type LucideIcon,
  PencilLine,
  Save,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { FileRow } from "@/lib/ipc-types";
import { cn } from "@/lib/utils";
import { DiffView } from "@/shared/components/diff-view";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { MarkdownEditor } from "@/shared/components/ui/markdown-editor";

import { type EditorMode, useFileContent } from "./use-file-content";

export interface EditorPaneProps {
  file: FileRow | null;
}

const EDITOR_MODES: {
  id: EditorMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "rich", label: "Edit", icon: PencilLine },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "raw", label: "Source", icon: Code2 },
];

function EditorModeTabs({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) {
  return (
    <fieldset className="flex shrink-0 items-center rounded-lg bg-muted p-0.5">
      <legend className="sr-only">Editor view</legend>
      {EDITOR_MODES.map(({ id, label, icon: Icon }) => (
        <button
          aria-pressed={mode === id}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium text-xs transition-colors motion-reduce:transition-none",
            mode === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </fieldset>
  );
}

function FrontmatterPanel({
  frontmatter,
  open,
  visible,
  onToggle,
}: {
  frontmatter: string | null;
  open: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  if (!visible || frontmatter === null) {
    return null;
  }

  return (
    <div className="border-border border-b">
      <button
        className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left text-muted-foreground text-xs hover:text-foreground"
        onClick={onToggle}
        type="button"
      >
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Frontmatter (read-only)
      </button>
      {open ? (
        <pre className="max-h-48 overflow-auto bg-muted/30 px-4 py-3 font-mono text-xs leading-5">
          {frontmatter}
        </pre>
      ) : null}
    </div>
  );
}

export function EditorPane({ file }: EditorPaneProps) {
  const editor = useFileContent(file?.id ?? null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [frontmatterOpen, setFrontmatterOpen] = useState(false);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a file to edit.
      </div>
    );
  }

  if (editor.loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (editor.error && !editor.buffer) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-destructive text-sm">
        {editor.error}
      </div>
    );
  }

  const buffer = editor.buffer;
  if (!buffer) {
    return null;
  }

  const handleSave = async (): Promise<void> => {
    const saved = await editor.save();
    if (saved) {
      toast.success(`Saved ${file.relPath}`);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 items-center gap-3 border-border border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{file.relPath}</p>
          <p className="truncate text-muted-foreground text-xs">
            {targetLabel(file.kind)} · {file.path}
          </p>
        </div>

        <EditorModeTabs mode={editor.mode} onChange={editor.setMode} />

        <Button
          aria-label="Reveal in Finder"
          onClick={async () => {
            try {
              await revealItemInDir(file.path);
            } catch (cause) {
              toast.error(`Could not reveal file: ${String(cause)}`);
            }
          }}
          size="icon-sm"
          title="Reveal in Finder"
          variant="ghost"
        >
          <FolderOpen />
        </Button>
        <Button
          disabled={!editor.dirty}
          onClick={() => setReviewOpen(true)}
          size="sm"
          variant="outline"
        >
          Review changes
        </Button>
        <Button
          disabled={!editor.dirty || editor.saving}
          onClick={async () => {
            await handleSave();
          }}
          size="sm"
        >
          <Save />
          {editor.saving ? "Saving…" : "Save"}
        </Button>
        <span aria-live="polite" className="sr-only">
          {editor.dirty ? "Unsaved changes" : "No unsaved changes"}
        </span>
      </header>

      {buffer.content.isSymlink ? (
        <p className="flex items-center gap-2 border-border border-b bg-chart-3/10 px-4 py-1.5 text-xs">
          <Link2 className="size-3.5" />
          Symlink — edits go to {buffer.content.symlinkTarget}
        </p>
      ) : null}

      {editor.changedOnDisk ? (
        <div className="flex items-center gap-2 border-border border-b bg-destructive/10 px-4 py-1.5 text-xs">
          <AlertTriangle className="size-3.5" />
          <span className="flex-1">This file changed on disk.</span>
          <Button
            onClick={async () => {
              await editor.reload();
            }}
            size="sm"
            variant="ghost"
          >
            Reload
          </Button>
        </div>
      ) : null}

      {editor.error ? (
        <p className="border-border border-b bg-destructive/10 px-4 py-1.5 text-destructive text-xs">
          {editor.error}
        </p>
      ) : null}

      <FrontmatterPanel
        frontmatter={buffer.split.frontmatter}
        onToggle={() => setFrontmatterOpen((open) => !open)}
        open={frontmatterOpen}
        visible={editor.mode !== "raw"}
      />

      {editor.mode === "rich" ? (
        <MarkdownEditor
          className="min-h-0 flex-1"
          key={file.id}
          onChange={editor.setBody}
          value={buffer.body}
        />
      ) : null}
      {editor.mode === "preview" ? (
        <MarkdownEditor
          className="min-h-0 flex-1"
          editable={false}
          key={file.id}
          onChange={editor.setBody}
          placeholder="Nothing to preview."
          value={buffer.body}
        />
      ) : null}
      {editor.mode === "raw" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4 sm:p-6">
          <textarea
            aria-label="Markdown source"
            className="mx-auto block h-full min-h-full w-full max-w-5xl resize-none bg-background px-8 py-8 font-mono text-[13px] leading-6 shadow-sm outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-muted/20 sm:px-10 sm:py-10"
            onChange={(event) => editor.setRaw(event.target.value)}
            spellCheck={false}
            value={buffer.raw}
          />
        </div>
      ) : null}

      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review changes</DialogTitle>
            <DialogDescription>
              Compare the current document with the saved file before writing it
              to disk.
            </DialogDescription>
          </DialogHeader>
          <DiffView
            after={editor.documentText}
            before={buffer.content.content}
            className="max-h-[60vh]"
          />
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={editor.dismissConflict} open={editor.conflict}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>File changed on disk</DialogTitle>
            <DialogDescription>
              {file.relPath} was modified since it was opened. Reload to discard
              your edits, or overwrite to keep them.
            </DialogDescription>
          </DialogHeader>
          <DiffView
            after={editor.documentText}
            before={buffer.content.content}
            className="max-h-[50vh]"
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                await editor.reload();
              }}
              variant="outline"
            >
              Reload from disk
            </Button>
            <Button
              onClick={async () => {
                await editor.overwrite();
              }}
              variant="destructive"
            >
              Overwrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
