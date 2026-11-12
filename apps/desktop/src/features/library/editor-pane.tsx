import { Button } from "@ctrl-ui/react/ui/button";
import { Kbd } from "@ctrl-ui/react/ui/kbd";
import { ScrollArea } from "@ctrl-ui/react/ui/scroll-area";
import { Skeleton } from "@ctrl-ui/react/ui/skeleton";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentPanel } from "@/features/agent/agent-panel";
import { useAgentSession } from "@/features/agent/use-agent-session";
import { LinksBar } from "@/features/links/links-bar";
import { MentionPreview } from "@/features/links/mention-preview";
import { useFileLinks } from "@/features/links/use-file-links";
import {
  type SkillMentions,
  useSkillMentions,
} from "@/features/links/use-skill-mentions";
import { scanSummary } from "@/features/scan/scan-status";
import type { UseScan } from "@/features/scan/use-scan";
import type { FileLinks, FileRow } from "@/lib/ipc-types";
import { EmptyState, ErrorState } from "@/shared/components/view-layout";

import {
  ConflictDialog,
  ReviewChangesDialog,
  TrashDialog,
} from "./editor/editor-dialogs";
import { EditorHeader } from "./editor/editor-header";
import { EditorNotices } from "./editor/editor-notices";
import { MetadataFields } from "./editor/metadata-fields";
import { RichEditor } from "./editor/rich-editor";
import { SourceEditor } from "./editor/source-editor";
import { fileTitle } from "./library-model";
import type { UseFileContent } from "./use-file-content";

export interface EditorPaneProps {
  editor: UseFileContent;
  favorite: boolean;
  file: FileRow | null;
  /** False while the library holds nothing to open, which changes what the empty pane suggests. */
  hasFiles: boolean;
  /** Called once the open file no longer exists, after it went to the Trash. */
  onClose: () => void;
  onNewSkill: () => void;
  /** Re-reads every library folder from disk; its outcome shows while nothing is open. */
  scan: UseScan;
  onOpenFile: (file: FileRow) => void;
  onToggleFavorite: (path: string) => Promise<void>;
}

const DOCUMENT_COLUMN =
  "mx-auto flex w-full max-w-3xl flex-col gap-8 px-10 py-8";
const AGENT_PANEL_STORAGE_KEY = "another-dev-tool.agent-panel";

function NothingOpen({
  hasFiles,
  onNewSkill,
  scan,
}: {
  hasFiles: boolean;
  onNewSkill: () => void;
  scan: UseScan;
}) {
  const failed = !scan.running && scan.error !== null;
  const scannedOnce = scan.running || scan.lastResult !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="h-(--titlebar-height) shrink-0" data-tauri-drag-region />
      <div className="flex min-h-0 flex-1 items-center justify-center pb-(--titlebar-height)">
        <EmptyState
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  disabled={scan.running}
                  onClick={() => {
                    scan.start();
                  }}
                  size="sm"
                  variant="surface"
                >
                  {scan.running ? (
                    <Spinner />
                  ) : (
                    <RefreshCw aria-hidden="true" />
                  )}
                  {scan.running ? "Scanning…" : "Scan folders"}
                </Button>
                <Button onClick={onNewSkill} size="sm" variant="surface">
                  New skill
                  <Kbd>⌘N</Kbd>
                </Button>
              </div>
              {failed ? (
                <Text as="p" role="alert" size="caption" tone="destructive">
                  {scan.error}
                </Text>
              ) : null}
              {!failed && scannedOnce ? (
                <Text
                  aria-live="polite"
                  as="p"
                  numeric
                  size="caption"
                  tone="muted"
                >
                  {scanSummary(scan)}
                </Text>
              ) : null}
            </div>
          }
          description={
            hasFiles
              ? "Pick a file in the library, or press ⌘K to search everything."
              : "Scan your folders for skills, or write your first one."
          }
          icon={FileText}
          title={hasFiles ? "Nothing open" : "No files yet"}
        />
      </div>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <output aria-label="Loading the file" className={DOCUMENT_COLUMN}>
      <Skeleton className="h-9 w-2/5" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </output>
  );
}

function DocumentBody({
  editor,
  file,
  links,
  mentions,
  onOpenFile,
}: {
  editor: UseFileContent;
  file: FileRow;
  links: FileLinks;
  mentions: SkillMentions;
  onOpenFile: (file: FileRow) => void;
}) {
  const { buffer } = editor;
  if (editor.loading) {
    return <DocumentSkeleton />;
  }
  if (!buffer) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <ErrorState
          message={editor.error ?? "The file could not be read."}
          onRetry={editor.reload}
        />
      </div>
    );
  }

  const label = `${fileTitle(file)} content`;
  if (editor.mode === "raw" || !buffer.rich) {
    return (
      <div className="min-h-0 flex-1">
        <SourceEditor
          label={`${label}, as source`}
          onChange={editor.setRaw}
          value={buffer.raw}
        />
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className={DOCUMENT_COLUMN}>
        <MetadataFields
          file={file}
          frontmatter={buffer.split.frontmatter}
          onChange={editor.setFrontmatterField}
          onEditSource={() => editor.setMode("raw")}
        />
        <LinksBar links={links} onSelect={onOpenFile} />
        <RichEditor
          document={buffer.rich}
          extensions={mentions.extensions}
          key={`${file.id}:${editor.revision}`}
          label={label}
          onChange={editor.setBody}
          onUnsupported={editor.abandonRich}
        />
      </div>
    </ScrollArea>
  );
}

export function EditorPane({
  editor,
  favorite,
  file,
  hasFiles,
  onClose,
  onNewSkill,
  scan,
  onOpenFile,
  onToggleFavorite,
}: EditorPaneProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  // Docked by default, like the editor's other half; closing it is remembered.
  const [agentOpen, setAgentOpen] = useState(
    () => window.localStorage.getItem(AGENT_PANEL_STORAGE_KEY) !== "closed"
  );
  const toggleAgent = (open: boolean) => {
    setAgentOpen(open);
    window.localStorage.setItem(
      AGENT_PANEL_STORAGE_KEY,
      open ? "open" : "closed"
    );
  };
  const agent = useAgentSession(file?.id ?? null);
  const links = useFileLinks(file?.id ?? null);
  const mentions = useSkillMentions({
    targets: links.outgoing,
    onOpen: onOpenFile,
  });

  // Closing or reloading the window is the one way to lose edits without being asked.
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
      <NothingOpen hasFiles={hasFiles} onNewSkill={onNewSkill} scan={scan} />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <section
        aria-label={fileTitle(file)}
        className="flex min-w-0 flex-1 flex-col"
      >
        <EditorHeader
          agentOpen={agentOpen}
          editor={editor}
          favorite={favorite}
          file={file}
          onReview={() => setReviewOpen(true)}
          onToggleAgent={() => toggleAgent(!agentOpen)}
          onToggleFavorite={onToggleFavorite}
          onTrash={() => setTrashOpen(true)}
        />
        <EditorNotices editor={editor} />
        <DocumentBody
          editor={editor}
          file={file}
          links={links}
          mentions={mentions}
          onOpenFile={onOpenFile}
        />
        <MentionPreview mentions={mentions} />
      </section>

      {agentOpen ? (
        <AgentPanel
          documentText={editor.documentText}
          onApply={editor.replaceDocument}
          onClose={() => toggleAgent(false)}
          session={agent}
        />
      ) : null}

      <ReviewChangesDialog
        editor={editor}
        onOpenChange={setReviewOpen}
        open={reviewOpen}
      />
      <ConflictDialog editor={editor} file={file} />
      <TrashDialog
        dirty={editor.dirty}
        file={file}
        onOpenChange={setTrashOpen}
        onTrashed={onClose}
        open={trashOpen}
      />
    </div>
  );
}
