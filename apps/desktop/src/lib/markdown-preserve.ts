import type { JSONContent } from "@tiptap/core";
import type { MarkdownManager } from "@tiptap/markdown";

import {
  type EditorBlock,
  mergeBlocks,
  type OriginalBlock,
  PARAGRAPH_SEPARATOR,
  TRAILING_WHITESPACE_PATTERN,
} from "./markdown-merge";

/**
 * A rich editor re-serializes the whole document on every keystroke, which
 * rewrites tables, list markers, spacing and escapes the user never touched.
 * This module keeps the file's own text for every block the user left alone:
 * only blocks that were actually edited come out of the serializer.
 */

/** Info string of the code fences that stand in for blocks the editor cannot represent. */
export const SOURCE_BLOCK_LANGUAGE = "markdown-source";

export interface PreservedMarkdown {
  /** The editor blocks of the untouched document, to check the editor parsed it the same way. */
  baseline: readonly EditorBlock[];
  /** What the rich editor is given: the body, with unsupported blocks shown as source. */
  editorMarkdown: string;
  /** Rebuilds the body from the editor's current blocks. */
  merge: (blocks: readonly EditorBlock[]) => string;
  /** How many blocks are shown as source. */
  sourceBlockCount: number;
}

const FENCE_RUN_PATTERN = /`{3,}/g;
// The editor's parser turns each blank line beyond the first into an empty
// paragraph. These two mirror how it finds them, so they map to blocks here too.
const ABSORBED_BLANK_LINES_PATTERN = /\n[^\S\n]*(?:\n[^\S\n]*)+$/;

export function describeNode(
  node: JSONContent,
  codec: MarkdownManager
): EditorBlock {
  const isSource =
    node.type === "codeBlock" && node.attrs?.language === SOURCE_BLOCK_LANGUAGE;
  return {
    markdown: codec.serialize({ type: "doc", content: [node] }),
    source: isSource
      ? (node.content ?? []).map((child) => child.text ?? "").join("")
      : null,
  };
}

function sourceFence(raw: string): string {
  const content = raw.replace(TRAILING_WHITESPACE_PATTERN, "");
  const longestRun = Math.max(
    2,
    ...(content.match(FENCE_RUN_PATTERN) ?? []).map((run) => run.length)
  );
  const fence = "`".repeat(longestRun + 1);
  return `${fence}${SOURCE_BLOCK_LANGUAGE}\n${content}\n${fence}${raw.slice(content.length)}`;
}

/**
 * Splits a run of blank lines into the part that merely separates two blocks
 * and one piece per empty paragraph the editor shows for the extra lines.
 */
function splitBlankLines(
  raw: string,
  isBetweenBlocks: boolean
): { separator: string; emptyParagraphs: string[] } {
  const pieces: string[] = [];
  let position = 0;
  let found = raw.indexOf(PARAGRAPH_SEPARATOR);
  while (found !== -1) {
    const end = found + PARAGRAPH_SEPARATOR.length;
    pieces.push(raw.slice(position, end));
    position = end;
    found = raw.indexOf(PARAGRAPH_SEPARATOR, position);
  }
  const rest = raw.slice(position);
  const kept = isBetweenBlocks ? pieces.splice(0, 1).join("") : "";
  const last = pieces.pop();
  if (last === undefined) {
    return { separator: kept + rest, emptyParagraphs: [] };
  }
  return { separator: kept, emptyParagraphs: [...pieces, last + rest] };
}

/** The file's blocks in order, with the editor nodes each one is expected to produce. */
interface Plan {
  blocks: OriginalBlock[];
  leading: string;
  nodeTypes: (string | undefined)[];
  sourceBlockCount: number;
}

function addBlankLines(plan: Plan, raw: string, hasContentAfter: boolean) {
  const previous = plan.blocks.at(-1);
  const { separator, emptyParagraphs } = splitBlankLines(
    raw,
    previous !== undefined && hasContentAfter
  );
  if (previous) {
    previous.raw += separator;
    previous.editor += separator;
  } else {
    plan.leading += separator;
  }
  for (const piece of emptyParagraphs) {
    plan.blocks.push({
      raw: piece,
      editor: piece,
      start: plan.nodeTypes.length,
      count: 1,
    });
    plan.nodeTypes.push("paragraph");
  }
}

/** Adds a content block. False when the editor shows nothing for it, which cannot be mapped back. */
function addContent(
  plan: Plan,
  raw: string,
  definitions: string,
  codec: MarkdownManager,
  requiresSource: (markdown: string) => boolean
): boolean {
  // Definitions travel with the block so reference-style links resolve as they do in the file.
  const isSource = requiresSource(
    definitions === "" ? raw : `${raw}${PARAGRAPH_SEPARATOR}${definitions}`
  );
  const editor = isSource ? sourceFence(raw) : raw;
  const nodes =
    codec.parse(editor.replace(TRAILING_WHITESPACE_PATTERN, "")).content ?? [];
  if (nodes.length === 0) {
    return false;
  }
  plan.sourceBlockCount += isSource ? 1 : 0;
  plan.blocks.push({
    raw,
    editor,
    start: plan.nodeTypes.length,
    count: nodes.length,
  });
  plan.nodeTypes.push(...nodes.map((node) => node.type));
  return true;
}

function planBlocks(
  text: string,
  codec: MarkdownManager,
  requiresSource: (markdown: string) => boolean
): Plan | null {
  const tokens = codec.instance.lexer(text);
  if (tokens.map((token) => token.raw).join("") !== text) {
    return null;
  }

  const definitions = tokens
    .filter((token) => token.type === "def")
    .map((token) => token.raw)
    .join("");
  const lastContent = tokens.findLastIndex((token) => token.type !== "space");
  const plan: Plan = {
    blocks: [],
    leading: "",
    nodeTypes: [],
    sourceBlockCount: 0,
  };

  for (const [position, token] of tokens.entries()) {
    const hasContentAfter = position < lastContent;
    if (token.type === "space") {
      addBlankLines(plan, token.raw, hasContentAfter);
      continue;
    }
    const absorbed =
      tokens[position + 1]?.type === "space"
        ? ""
        : (ABSORBED_BLANK_LINES_PATTERN.exec(token.raw)?.[0] ?? "");
    const raw = token.raw.slice(0, token.raw.length - absorbed.length);
    if (token.type === "def") {
      plan.blocks.push({
        raw,
        editor: raw,
        start: plan.nodeTypes.length,
        count: 0,
      });
    } else if (!addContent(plan, raw, definitions, codec, requiresSource)) {
      return null;
    }
    if (absorbed !== "") {
      addBlankLines(plan, absorbed, hasContentAfter);
    }
  }
  return plan;
}

/**
 * Prepares `body` for the rich editor. Returns null when the document cannot be
 * mapped block by block with certainty; the caller then keeps it in source mode
 * rather than risk rewriting it.
 */
export function preserveMarkdown(
  body: string,
  codec: MarkdownManager,
  requiresSource: (markdown: string) => boolean
): PreservedMarkdown | null {
  const usesCrlf = body.includes("\r\n");
  const text = usesCrlf ? body.replaceAll("\r\n", "\n") : body;
  const restore = (merged: string) =>
    usesCrlf ? merged.replaceAll("\n", "\r\n") : merged;
  if (text.includes("\r") || restore(text) !== body) {
    return null;
  }

  const plan = planBlocks(text, codec, requiresSource);
  if (!plan) {
    return null;
  }
  const { blocks, leading, nodeTypes, sourceBlockCount } = plan;

  const editorMarkdown = leading + blocks.map((block) => block.editor).join("");
  const parsed = codec.parse(editorMarkdown).content ?? [];
  const isSameShape =
    parsed.length === nodeTypes.length &&
    parsed.every((node, index) => node.type === nodeTypes[index]);
  if (!isSameShape) {
    return null;
  }

  const baseline = parsed.map((node) => describeNode(node, codec));
  const original = { body: text, leading, blocks, baseline };
  if (restore(mergeBlocks(original, baseline)) !== body) {
    return null;
  }

  return {
    editorMarkdown,
    baseline,
    sourceBlockCount,
    merge: (next) => restore(mergeBlocks(original, next)),
  };
}
