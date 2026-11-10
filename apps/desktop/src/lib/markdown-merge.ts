import { alignBlocks } from "./align-blocks";

/**
 * Writes a document back from the editor's blocks, keeping the file's own text
 * for every block the user left alone.
 */

/** One top-level node of the editor document, as merging needs to see it. */
export interface EditorBlock {
  /** The node serialized on its own. */
  markdown: string;
  /** The raw Markdown a source placeholder holds; null for every regular node. */
  source: string | null;
}

export interface OriginalBlock {
  /** How many editor nodes it produced; none for link definitions. */
  count: number;
  /** What the editor is given in its place. */
  editor: string;
  /** The block exactly as written, with the blank lines that follow it. */
  raw: string;
  /** Index of its first node in the baseline. */
  start: number;
}

export interface Original {
  baseline: readonly EditorBlock[];
  blocks: readonly OriginalBlock[];
  body: string;
  leading: string;
}

export const PARAGRAPH_SEPARATOR = "\n\n";
export const TRAILING_WHITESPACE_PATTERN = /\s*$/;
const TRAILING_NEWLINES_PATTERN = /\n*$/;
// What the merged output ends with: the leading whitespace, or rewritten text.
const LEADING = -1;
const REWRITTEN = -2;

function withBlankLine(text: string): string {
  if (text === "" || text.endsWith(PARAGRAPH_SEPARATOR)) {
    return text;
  }
  return text.endsWith("\n") ? `${text}\n` : `${text}${PARAGRAPH_SEPARATOR}`;
}

/** A block is intact when each of its nodes is still there, side by side. */
function isIntact(block: OriginalBlock, matches: readonly number[]): boolean {
  const first = matches[block.start] ?? -1;
  for (let offset = 0; offset < block.count; offset += 1) {
    const match = matches[block.start + offset] ?? -1;
    if (match === -1 || match !== first + offset) {
      return false;
    }
  }
  return true;
}

/**
 * A block dragged elsewhere shows up as removed here and added there: its own
 * text is reused at the new place rather than a re-serialized copy.
 */
function movedBlocks(
  { blocks, baseline }: Original,
  intact: readonly boolean[]
): Map<string, string[]> {
  const moved = new Map<string, string[]>();
  for (const [index, block] of blocks.entries()) {
    const markdown = baseline[block.start]?.markdown;
    if (block.count === 1 && !intact[index] && markdown !== undefined) {
      moved.set(markdown, [...(moved.get(markdown) ?? []), block.raw]);
    }
  }
  return moved;
}

/** The merged body while it is being written. */
interface Merge {
  /** Index of the next editor block that is not written yet. */
  cursor: number;
  moved: Map<string, string[]>;
  next: readonly EditorBlock[];
  output: string;
  /** Index of the block the output currently ends with, when it ends verbatim. */
  tail: number;
}

function emitVerbatim(merge: Merge, index: number, raw: string) {
  const before =
    merge.tail === index - 1 ? merge.output : withBlankLine(merge.output);
  merge.output = before + raw;
  merge.tail = index;
}

function emitChunk(merge: Merge, chunk: string) {
  const content = chunk.replace(TRAILING_WHITESPACE_PATTERN, "");
  if (content.trim() === "") {
    return;
  }
  merge.output = `${withBlankLine(merge.output)}${content}${PARAGRAPH_SEPARATOR}`;
  merge.tail = REWRITTEN;
}

/** Writes the editor blocks before `end` that match nothing in the file: the ones the user added. */
function emitAddedUntil(merge: Merge, end: number) {
  for (; merge.cursor < end; merge.cursor += 1) {
    const block = merge.next[merge.cursor];
    if (block) {
      emitChunk(
        merge,
        merge.moved.get(block.markdown)?.shift() ??
          block.source ??
          block.markdown
      );
    }
  }
}

/** Writes what is left of a block the user edited: each surviving node, serialized again. */
function emitRewritten(
  merge: Merge,
  block: OriginalBlock,
  matches: readonly number[]
) {
  for (let offset = 0; offset < block.count; offset += 1) {
    const match = matches[block.start + offset] ?? -1;
    if (match !== -1) {
      emitAddedUntil(merge, match);
      merge.cursor = match + 1;
      emitChunk(merge, merge.next[match]?.markdown ?? "");
    }
  }
}

export function mergeBlocks(
  original: Original,
  next: readonly EditorBlock[]
): string {
  const { body, leading, blocks, baseline } = original;
  const matches = alignBlocks(
    baseline.map((block) => block.markdown),
    next.map((block) => block.markdown)
  );
  const intact = blocks.map((block) => isIntact(block, matches));
  const merge: Merge = {
    cursor: 0,
    moved: movedBlocks(original, intact),
    next,
    output: leading,
    tail: LEADING,
  };

  for (const [index, block] of blocks.entries()) {
    if (!intact[index]) {
      emitRewritten(merge, block, matches);
      continue;
    }
    // Link definitions produce no node, so the editor cannot remove them:
    // they count as intact and stay where they were.
    if (block.count > 0) {
      emitAddedUntil(merge, matches[block.start] ?? merge.cursor);
      merge.cursor += block.count;
    }
    emitVerbatim(merge, index, block.raw);
  }
  emitAddedUntil(merge, next.length);

  if (merge.tail === blocks.length - 1) {
    return merge.output;
  }
  const ending = TRAILING_NEWLINES_PATTERN.exec(body)?.[0] || "\n";
  const content = merge.output.replace(TRAILING_WHITESPACE_PATTERN, "");
  return content === "" ? "" : `${content}${ending}`;
}
