import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { AlertTriangle, FolderOpen, Link2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { FileRow } from "@/lib/ipc-types";
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

import { useFileContent } from "./use-file-content";

export interface EditorPaneProps {
  file: FileRow | null;
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

  const handleSave = async () => {
    await editor.save();
    if (!editor.conflict) {
      toast.success(`Saved ${file.relPath}`);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-border border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{file.relPath}</p>
          <p className="truncate text-muted-foreground text-xs">
            {targetLabel(file.kind)} · {file.path}
          </p>
        </div>

        <Button
          onClick={() => {
            revealItemInDir(file.path);
          }}
          size="sm"
          title="Reveal in Finder"
          variant="ghost"
        >
          <FolderOpen />
        </Button>
        <Button
          onClick={() =>
            editor.setMode(editor.mode === "rich" ? "raw" : "rich")
          }
          size="sm"
          variant="outline"
        >
          {editor.mode === "rich" ? "Raw" : "Rich"}
        </Button>
        <Button onClick={() => setReviewOpen(true)} size="sm" variant="outline">
          Review changes
        </Button>
        <Button
          disabled={!editor.dirty || editor.saving}
          onClick={() => {
            handleSave();
          }}
          size="sm"
        >
          <Save />
          {editor.saving ? "Saving…" : "Save"}
        </Button>
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
            onClick={() => {
              editor.reload();
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

      {buffer.split.frontmatter !== null && editor.mode === "rich" ? (
        <div className="border-border border-b">
          <button
            className="w-full px-4 py-1.5 text-left text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setFrontmatterOpen((open) => !open)}
            type="button"
          >
            {frontmatterOpen ? "▾" : "▸"} frontmatter (read-only)
          </button>
          {frontmatterOpen ? (
            <pre className="max-h-48 overflow-auto bg-muted/30 px-4 py-2 font-mono text-xs">
              {buffer.split.frontmatter}
            </pre>
          ) : null}
        </div>
      ) : null}

      {editor.mode === "rich" ? (
        <MarkdownEditor
          className="min-h-0 flex-1"
          onChange={editor.setBody}
          value={buffer.body}
        />
      ) : (
        <textarea
          className="min-h-0 flex-1 resize-none bg-background px-6 py-5 font-mono text-sm outline-none"
          onChange={(event) => editor.setRaw(event.target.value)}
          spellCheck={false}
          value={buffer.raw}
        />
      )}

      <Dialog onOpenChange={setReviewOpen} open={reviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review changes</DialogTitle>
            <DialogDescription>
              Buffer compared with what is on disk — the editor may reformat
              markdown it did not touch.
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
              onClick={() => {
                editor.reload();
              }}
              variant="outline"
            >
              Reload from disk
            </Button>
            <Button
              onClick={() => {
                editor.overwrite();
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
