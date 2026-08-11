import { type Editor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  FileCode2,
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

import { cn } from "@/lib/utils";

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
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40"
      )}
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
  return <div className="mx-1 h-5 w-px bg-foreground/10" />;
}

export function MarkdownToolbar({
  editor,
  onOpenLink,
}: {
  editor: Editor;
  onOpenLink: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      heading1: instance.isActive("heading", { level: 1 }),
      heading2: instance.isActive("heading", { level: 2 }),
      heading3: instance.isActive("heading", { level: 3 }),
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      strike: instance.isActive("strike"),
      inlineCode: instance.isActive("code"),
      codeBlock: instance.isActive("codeBlock"),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      blockquote: instance.isActive("blockquote"),
      link: instance.isActive("link"),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  return (
    <div
      aria-label="Formatting"
      className="flex min-h-11 flex-wrap items-center gap-0.5 border-border border-b bg-background px-3 py-1.5"
      role="toolbar"
    >
      <ToolbarButton
        isActive={state.heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        isActive={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.inlineCode}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <Code className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <FileCode2 className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        isActive={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        isActive={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        isActive={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <Quote className="size-4" />
      </ToolbarButton>
      <ToolbarButton isActive={state.link} onClick={onOpenLink} title="Link">
        <LinkIcon className="size-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
      >
        <Undo className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
      >
        <Redo className="size-4" />
      </ToolbarButton>
    </div>
  );
}
