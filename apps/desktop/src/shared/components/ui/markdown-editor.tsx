import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { MarkdownToolbar } from "./markdown-toolbar";

function preventUnavailableHistoryShortcut(
  event: KeyboardEvent,
  editor: Editor
): void {
  if (!(event.metaKey || event.ctrlKey)) {
    return;
  }
  const key = event.key.toLowerCase();
  const undoRequested = key === "z" && !event.shiftKey;
  const redoRequested = (key === "z" && event.shiftKey) || key === "y";
  const unavailable =
    (undoRequested && !editor.can().undo()) ||
    (redoRequested && !editor.can().redo());
  if (!unavailable) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}

interface SyncedSource {
  value: string;
  canonical: string;
}

export function MarkdownEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Write your content here...",
  className,
}: MarkdownEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const lastSyncedValueRef = useRef(value);
  const syncedSourceRef = useRef<SyncedSource | null>(null);
  const lastObservedCanonicalRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-chart-3 underline underline-offset-2 hover:text-chart-4",
        },
      }),
      Markdown,
    ],
    content: value,
    contentType: "markdown",
    editable,
    editorProps: {
      attributes: {
        "aria-label": editable ? "Markdown editor" : "Markdown preview",
        class: cn(
          "tiptap-editor mx-auto min-h-full w-full max-w-[72ch] px-8 py-8 outline-none sm:px-10 sm:py-10",
          !editable && "tiptap-preview"
        ),
      },
    },
    onCreate: ({ editor: instance }) => {
      const canonical = instance.getMarkdown().trimEnd();
      syncedSourceRef.current = { value, canonical };
      lastObservedCanonicalRef.current = canonical;
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = instance.getMarkdown();
      const canonical = markdown.trimEnd();
      if (canonical === lastObservedCanonicalRef.current) {
        return;
      }
      lastObservedCanonicalRef.current = canonical;
      const syncedSource = syncedSourceRef.current;
      const nextValue =
        syncedSource?.canonical === canonical ? syncedSource.value : markdown;
      lastSyncedValueRef.current = nextValue;
      onChange(nextValue);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
    if (value !== lastSyncedValueRef.current) {
      lastSyncedValueRef.current = value;
      editor.commands.setContent(value, {
        contentType: "markdown",
        emitUpdate: false,
      });
      const canonical = editor.getMarkdown().trimEnd();
      syncedSourceRef.current = { value, canonical };
      lastObservedCanonicalRef.current = canonical;
    }
  }, [editable, editor, value]);

  const openLinkDialog = useCallback(() => {
    if (!editor) {
      return;
    }
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkDialogOpen(true);
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor) {
      return;
    }
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  if (!editor) {
    return <div className={cn("flex-1 bg-muted/20", className)} />;
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {editable ? (
        <MarkdownToolbar editor={editor} onOpenLink={openLinkDialog} />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4 sm:p-6">
        <EditorContent
          className={cn(
            "mx-auto min-h-full w-full max-w-5xl bg-background shadow-sm",
            editable &&
              "focus-within:ring-2 focus-within:ring-ring/30 focus-within:ring-offset-2 focus-within:ring-offset-muted/20"
          )}
          editor={editor}
          onKeyDownCapture={(event) =>
            preventUnavailableHistoryShortcut(event, editor)
          }
        />
      </div>

      {editable ? (
        <Dialog onOpenChange={setLinkDialogOpen} open={linkDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Insert link</DialogTitle>
              <DialogDescription>
                Enter the URL for the link. Leave it empty to remove the link.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <input
                aria-label="Link URL"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleLinkSubmit();
                  }
                }}
                placeholder="https://example.com"
                type="url"
                value={linkUrl}
              />
            </div>
            <DialogFooter>
              <button
                className="rounded-xl bg-muted px-4 py-2 text-sm transition-colors hover:bg-muted/70"
                onClick={() => setLinkDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-foreground px-4 py-2 text-background text-sm transition-colors hover:bg-foreground/90"
                onClick={handleLinkSubmit}
                type="button"
              >
                {linkUrl ? "Apply" : "Remove link"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
