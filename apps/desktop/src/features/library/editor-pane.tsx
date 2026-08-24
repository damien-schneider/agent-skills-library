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
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AgentPanel } from "@/features/agent/agent-panel";
import { useAgentSession } from "@/features/agent/use-agent-session";
import { LinksBar } from "@/features/links/links-bar";
import { LocalGraph } from "@/features/links/local-graph";
import { MentionPreview } from "@/features/links/mention-preview";
import { useFileLinks } from "@/features/links/use-file-links";
import { useSkillMentions } from "@/features/links/use-skill-mentions";
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
import { Tooltip } from "@/shared/components/ui/tooltip";

import { SaveBar } from "./save-bar";

import type { EditorMode, UseFileContent } from "./use-file-content";

export interface EditorPaneProps {
  editor: UseFileContent;
  file: FileRow | null;
  favorite: boolean;
  onOpenFile: (file: FileRow) => void;
  onToggleFavorite: (path: string) => Promise<void>;
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

function ProjectFavoriteButton({
  path,
  favorite,
  onToggle,
}: {
  path: string;
  favorite: boolean;
  onToggle: (path: string) => Promise<void>;
}) {
  return (
    <Button
      aria-label={`${favorite ? "Remove" : "Add"} project ${favorite ? "from" : "to"} favorites`}
      aria-pressed={favorite}
      onClick={async () => {
        await onToggle(path);
      }}
      size="icon-sm"
      title={favorite ? "Remove project from favorites" : "Favorite project"}
      variant="ghost"
    >
      <Star className={favorite ? "fill-current" : undefined} />
    </Button>
  );
}

function EditorActions({
  agentOpen,
  editor,
  favorite,
  file,
  onToggleAgent,
  onToggleFavorite,
}: {
  agentOpen: boolean;
  editor: UseFileContent;
  favorite: boolean;
  file: FileRow;
  onToggleAgent: () => void;
  onToggleFavorite: (path: string) => Promise<void>;
}) {
  return (
    <>
      {file.projectDir ? (
        <ProjectFavoriteButton
          favorite={favorite}
          onToggle={onToggleFavorite}
          path={file.projectDir}
        />
      ) : null}

      <EditorModeTabs mode={editor.mode} onChange={editor.setMode} />

      <Tooltip label="Reveal in Finder">
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
          variant="ghost"
        >
          <FolderOpen />
        </Button>
      </Tooltip>
      <Tooltip label="Ask AI">
        <Button
          aria-label="Ask AI"
          aria-pressed={agentOpen}
          onClick={onToggleAgent}
          size="icon-sm"
          variant={agentOpen ? "secondary" : "ghost"}
        >
          <Sparkles />
        </Button>
      </Tooltip>
    </>
  );
}

export function EditorPane({
  editor,
  file,
  favorite,
  onOpenFile,
  onToggleFavorite,
}: EditorPaneProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [frontmatterOpen, setFrontmatterOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const agent = useAgentSession(file?.id ?? null);
  const links = useFileLinks(file?.id ?? null);
  const mentions = useSkillMentions({
    targets: links.outgoing,
    onOpen: onOpenFile,
  });
  useEffect(() => {
    if (!editor.dirty) {
      return;
    }
    const preventAccidentalClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventAccidentalClose);
    return () => {
      window.removeEventListener("beforeunload", preventAccidentalClose);
    };
  }, [editor.dirty]);

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

  const save = async () => {
    const saved = await editor.save();
    if (saved) {
      toast.success(`Saved ${file.relPath}`);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{file.relPath}</p>
            <p className="truncate text-muted-foreground text-xs">
              {targetLabel(file.kind)} · {file.path}
            </p>
          </div>
          <EditorActions
            agentOpen={agentOpen}
            editor={editor}
            favorite={favorite}
            file={file}
            onToggleAgent={() => setAgentOpen((open) => !open)}
            onToggleFavorite={onToggleFavorite}
          />
        </header>

        <LinksBar links={links} onSelect={onOpenFile} />

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
            <Button onClick={editor.reload} size="sm" variant="ghost">
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

        <div className="relative flex min-h-0 flex-1 flex-col">
          {editor.mode === "raw" ? null : (
            <MarkdownEditor
              className="min-h-0 flex-1"
              editable={editor.mode === "rich"}
              extensions={mentions.extensions}
              key={file.id}
              onChange={editor.setBody}
              placeholder={
                editor.mode === "preview" ? "Nothing to preview." : undefined
              }
              value={buffer.body}
            />
          )}
          <MentionPreview mentions={mentions} />
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
          <div className="absolute top-3 right-3 hidden lg:block">
            <LocalGraph links={links} onOpen={onOpenFile} />
          </div>

          <SaveBar
            dirty={editor.dirty}
            onReview={() => setReviewOpen(true)}
            onSave={save}
            saving={editor.saving}
          />
        </div>
      </div>

      {agentOpen ? (
        <AgentPanel
          documentText={editor.documentText}
          onApply={editor.replaceDocument}
          onClose={() => setAgentOpen(false)}
          session={agent}
        />
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
            <Button onClick={editor.reload} variant="outline">
              Reload from disk
            </Button>
            <Button onClick={editor.overwrite} variant="destructive">
              Overwrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
