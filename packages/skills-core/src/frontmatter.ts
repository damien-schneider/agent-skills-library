export type LineEnding = "\n" | "\r\n";

export interface FrontmatterSplit {
  /** YAML text between the fences, fences excluded; null when the document has none */
  frontmatter: string | null;
  body: string;
  lineEnding: LineEnding;
  /** BOM + opening fence + newline, verbatim */
  prefix: string;
  /** closing fence + its newline (empty at EOF), verbatim */
  suffix: string;
}

const OPEN_FENCE_PATTERN = /^(?:\uFEFF)?---[^\S\r\n]*\r?\n/;
const CLOSE_FENCE_PATTERN = /^---[^\S\r\n]*$/;
const CRLF_PATTERN = /\r\n/;

function detectLineEnding(content: string): LineEnding {
  return CRLF_PATTERN.test(content) ? "\r\n" : "\n";
}

function withoutFrontmatter(content: string): FrontmatterSplit {
  return {
    frontmatter: null,
    body: content,
    lineEnding: detectLineEnding(content),
    prefix: "",
    suffix: "",
  };
}

function stripCarriageReturn(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

export function splitFrontmatter(content: string): FrontmatterSplit {
  const openMatch = OPEN_FENCE_PATTERN.exec(content);
  if (!openMatch) {
    return withoutFrontmatter(content);
  }

  const prefix = openMatch[0];
  const lineEnding: LineEnding = prefix.endsWith("\r\n") ? "\r\n" : "\n";
  const contentStart = prefix.length;

  let cursor = contentStart;
  while (cursor <= content.length) {
    const newlineIndex = content.indexOf("\n", cursor);
    const lineEnd = newlineIndex === -1 ? content.length : newlineIndex;
    const line = stripCarriageReturn(content.slice(cursor, lineEnd));

    if (CLOSE_FENCE_PATTERN.test(line)) {
      const frontmatterEnd =
        cursor === contentStart
          ? contentStart
          : cursor - (content[cursor - 2] === "\r" ? 2 : 1);
      const bodyStart = newlineIndex === -1 ? content.length : newlineIndex + 1;

      return {
        frontmatter: content.slice(contentStart, frontmatterEnd),
        body: content.slice(bodyStart),
        lineEnding,
        prefix,
        suffix: content.slice(cursor, bodyStart),
      };
    }

    if (newlineIndex === -1) {
      break;
    }
    cursor = newlineIndex + 1;
  }

  return withoutFrontmatter(content);
}

export function joinFrontmatter(split: FrontmatterSplit): string {
  const { frontmatter, body, lineEnding, prefix, suffix } = split;
  if (frontmatter === null) {
    return body;
  }

  const inner = frontmatter === "" ? "" : `${frontmatter}${lineEnding}`;
  return `${prefix}${inner}${suffix}${body}`;
}

export function hasFrontmatter(content: string): boolean {
  return splitFrontmatter(content).frontmatter !== null;
}
