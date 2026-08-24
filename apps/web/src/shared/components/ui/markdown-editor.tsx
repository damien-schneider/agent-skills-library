"use client";

import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hasError?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      className={`rounded-lg p-2 transition-colors ${
        isActive
          ? "bg-foreground/10 text-foreground"
          : "text-foreground/50 hover:bg-foreground/5 hover:text-foreground/80"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-foreground/10" />;
}

function EditorSkeleton({ hasError }: { hasError?: boolean }) {
  return (
    <div
      className={`rounded-2xl border bg-white ${hasError ? "ring-2 ring-red-200" : "border-gray-100"}`}
    >
      <div className="flex items-center gap-0.5 border-gray-100 border-b px-3 py-2">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="min-h-[200px] animate-pulse bg-gray-50/50 px-5 py-4" />
    </div>
  );
}

// Inner editor component that uses TipTap hooks
function MarkdownEditorInner({
  value,
  onChange,
  onBlur,
  placeholder = "Write your content here...",
  hasError,
}: MarkdownEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // Import TipTap modules dynamically on client side only
  const [TipTapModules, setTipTapModules] = useState<{
    useEditor: typeof import("@tiptap/react").useEditor;
    EditorContent: typeof import("@tiptap/react").EditorContent;
    StarterKit: typeof import("@tiptap/starter-kit").default;
    Placeholder: typeof import("@tiptap/extension-placeholder").default;
    Link: typeof import("@tiptap/extension-link").default;
    Markdown: typeof import("@tiptap/markdown").Markdown;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Load TipTap modules on client side
    Promise.all([
      import("@tiptap/react"),
      import("@tiptap/starter-kit"),
      import("@tiptap/extension-placeholder"),
      import("@tiptap/extension-link"),
      import("@tiptap/markdown"),
    ]).then(([react, starterKit, placeholder, link, markdown]) => {
      setTipTapModules({
        useEditor: react.useEditor,
        EditorContent: react.EditorContent,
        StarterKit: starterKit.default,
        Placeholder: placeholder.default,
        Link: link.default,
        Markdown: markdown.Markdown,
      });
    });
  }, []);

  if (!(isMounted && TipTapModules)) {
    return <EditorSkeleton hasError={hasError} />;
  }

  return (
    <EditorWithModules
      hasError={hasError}
      linkDialogOpen={linkDialogOpen}
      linkUrl={linkUrl}
      modules={TipTapModules}
      onBlur={onBlur}
      onChange={onChange}
      placeholder={placeholder}
      setLinkDialogOpen={setLinkDialogOpen}
      setLinkUrl={setLinkUrl}
      value={value}
    />
  );
}

// Separate component that receives the loaded modules
function EditorWithModules({
  value,
  onChange,
  onBlur,
  placeholder,
  hasError,
  modules,
  linkDialogOpen,
  setLinkDialogOpen,
  linkUrl,
  setLinkUrl,
}: MarkdownEditorProps & {
  modules: {
    useEditor: typeof import("@tiptap/react").useEditor;
    EditorContent: typeof import("@tiptap/react").EditorContent;
    StarterKit: typeof import("@tiptap/starter-kit").default;
    Placeholder: typeof import("@tiptap/extension-placeholder").default;
    Link: typeof import("@tiptap/extension-link").default;
    Markdown: typeof import("@tiptap/markdown").Markdown;
  };
  linkDialogOpen: boolean;
  setLinkDialogOpen: (open: boolean) => void;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
}) {
  const { useEditor, EditorContent, StarterKit, Placeholder, Link, Markdown } =
    modules;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
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
    editorProps: {
      attributes: {
        class: "tiptap-editor outline-none min-h-[200px] px-5 py-4",
      },
      handleClick: (_view, _pos, event) => {
        if (!(event.metaKey || event.ctrlKey)) {
          return false;
        }
        const { target } = event;
        if (!(target instanceof Element)) {
          return false;
        }
        const href = target.closest("a")?.getAttribute("href");
        if (!href) {
          return false;
        }
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getMarkdown()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "";
    setLinkUrl(previousUrl);
    setLinkDialogOpen(true);
  }, [editor, setLinkUrl, setLinkDialogOpen]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor) return;

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
  }, [editor, linkUrl, setLinkDialogOpen, setLinkUrl]);

  if (!editor) {
    return <EditorSkeleton hasError={hasError} />;
  }

  return (
    <>
      <div
        className={`rounded-2xl border bg-white transition-all ${
          hasError
            ? "ring-2 ring-red-200"
            : editor.isFocused
              ? "border-gray-200 ring-2 ring-gray-100"
              : "border-gray-100"
        }`}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-gray-100 border-b px-3 py-2">
          {/* Headings */}
          <ToolbarButton
            isActive={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Text formatting */}
          <ToolbarButton
            isActive={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Lists */}
          <ToolbarButton
            isActive={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Block elements */}
          <ToolbarButton
            isActive={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            isActive={editor.isActive("link")}
            onClick={openLinkDialog}
            title="Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* History */}
          <ToolbarButton
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog */}
      <Dialog onOpenChange={setLinkDialogOpen} open={linkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Enter the URL for the link. Leave empty to remove the link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <input
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100"
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
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
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm transition-colors hover:bg-gray-200"
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
              {linkUrl ? "Apply" : "Remove Link"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export the dynamically loaded component to prevent SSR issues
export const MarkdownEditor = dynamic(
  () => Promise.resolve(MarkdownEditorInner),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);
