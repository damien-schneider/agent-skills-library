import {
  createMarkdownCodec,
  type MarkdownUrlPolicy,
  persistentUrlPolicy,
  requiresMarkdownSource,
} from "@ctrl-ui/react/markdown-editor/extensions";
import type { MarkdownManager } from "@tiptap/markdown";

import { type PreservedMarkdown, preserveMarkdown } from "./markdown-preserve";

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const UNSAFE_PATH_PATTERN = /[\s\\]/;
const FIRST_PRINTABLE_CODE = 32;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    if (character.charCodeAt(0) < FIRST_PRINTABLE_CODE) {
      return true;
    }
  }
  return false;
}

/**
 * Which URLs the visual editor keeps. Files link to their neighbours
 * (`references/forms.md`), so relative links stay editable; anything with a
 * scheme, and every image, must still pass the editor's own safety rules.
 */
export const isDocumentUrlAllowed: MarkdownUrlPolicy = (url, kind) => {
  if (kind === "image" || SCHEME_PATTERN.test(url)) {
    return persistentUrlPolicy(url, kind);
  }
  return (
    url !== "" &&
    !url.startsWith("//") &&
    !UNSAFE_PATH_PATTERN.test(url) &&
    !hasControlCharacter(url)
  );
};

let codec: MarkdownManager | null = null;

/** The Markdown codec the visual editor parses with; built on first use, it is not cheap. */
export function documentCodec(): MarkdownManager {
  codec ??= createMarkdownCodec({ isUrlAllowed: isDocumentUrlAllowed });
  return codec;
}

/**
 * Prepares a document body for the visual editor, or returns null when it can
 * only be edited as source without risking a rewrite.
 */
export function prepareRichDocument(body: string): PreservedMarkdown | null {
  const manager = documentCodec();
  try {
    return preserveMarkdown(body, manager, (markdown) =>
      requiresMarkdownSource(markdown, manager, isDocumentUrlAllowed)
    );
  } catch {
    // A parser failure on unusual input is exactly the case source mode exists for.
    return null;
  }
}
