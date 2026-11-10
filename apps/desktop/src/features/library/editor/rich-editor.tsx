import {
  MarkdownEditor,
  MarkdownEditorContent,
} from "@ctrl-ui/react/markdown-editor";
import { MarkdownEditorBubbleMenu } from "@ctrl-ui/react/markdown-editor/bubble-menu";
import { useMarkdownEditor } from "@ctrl-ui/react/markdown-editor/context";
import { MarkdownEditorSuggestions } from "@ctrl-ui/react/markdown-editor/suggestions";
import type { Extensions } from "@tiptap/core";
import type { Node as DocumentNode } from "@tiptap/pm/model";
import { useEffect, useEffectEvent } from "react";

import { documentCodec, isDocumentUrlAllowed } from "@/lib/document-markdown";
import type { EditorBlock } from "@/lib/markdown-merge";
import { describeNode, type PreservedMarkdown } from "@/lib/markdown-preserve";

// The page scrolls, not the editor: it grows with its content and draws no frame of its own.
const EDITOR_STYLE = {
  "--cui-markdown-editor-background": "transparent",
  "--cui-markdown-editor-border-width": "0px",
  "--cui-markdown-editor-radius": "0px",
  "--cui-markdown-editor-max-height": "100%",
  "--cui-markdown-editor-min-height": "40dvh",
} as const;

/**
 * Turns the editor's document back into the file's text, reusing the original
 * text of every block the user did not touch.
 */
function PreserveBridge({
  document,
  onChange,
  onUnsupported,
}: {
  document: PreservedMarkdown;
  onChange: (body: string) => void;
  onUnsupported: () => void;
}) {
  const { editor, source } = useMarkdownEditor();
  const change = useEffectEvent(onChange);
  const unsupported = useEffectEvent(onUnsupported);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const codec = documentCodec();
    // Untouched nodes keep their identity between edits, so only the edited block is serialized again.
    const described = new WeakMap<DocumentNode, EditorBlock>();
    const read = () => {
      const blocks: EditorBlock[] = [];
      for (const node of editor.state.doc.children) {
        const block = described.get(node) ?? describeNode(node.toJSON(), codec);
        described.set(node, block);
        blocks.push(block);
      }
      return blocks;
    };

    // The editor must read the file the way it was planned for: if writing its
    // untouched document back would change the file, saving from it is not safe.
    // (It may add an empty last line to click into; that writes nothing.)
    const isFaithful =
      !source && document.merge(read()) === document.merge(document.baseline);
    if (!isFaithful) {
      unsupported();
      return;
    }

    const handleUpdate = () => change(document.merge(read()));
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, source, document]);

  return null;
}

function RichEditorContent({ label }: { label: string }) {
  const { editor } = useMarkdownEditor();
  // Until the editor exists the library shows the raw text in a disabled box; hiding it avoids a flash of source.
  return (
    <MarkdownEditorContent
      className={editor ? undefined : "invisible"}
      label={label}
      placeholder="Write the instructions. Type / for headings, lists and code."
    />
  );
}

/**
 * The visual editor. It is uncontrolled: give it a new `key` to show another
 * document.
 */
export function RichEditor({
  document,
  extensions,
  label,
  onChange,
  onUnsupported,
}: {
  document: PreservedMarkdown;
  extensions: Extensions;
  label: string;
  onChange: (body: string) => void;
  onUnsupported: () => void;
}) {
  return (
    <MarkdownEditor
      className="document-editor"
      defaultValue={document.editorMarkdown}
      extensions={extensions}
      isUrlAllowed={isDocumentUrlAllowed}
      style={EDITOR_STYLE}
    >
      <RichEditorContent label={label} />
      <MarkdownEditorBubbleMenu />
      <MarkdownEditorSuggestions />
      <PreserveBridge
        document={document}
        onChange={onChange}
        onUnsupported={onUnsupported}
      />
    </MarkdownEditor>
  );
}
