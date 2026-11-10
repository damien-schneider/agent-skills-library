import { Document, isMap, isScalar, parseDocument } from "yaml";

export type FrontmatterKey = "name" | "description";

export interface FrontmatterFields {
  description: string;
  name: string;
  /** The remaining top-level keys, in file order; only source mode edits them. */
  otherKeys: string[];
  /** Why the fields cannot be edited one by one; null when they can. */
  problem: string | null;
}

const TRAILING_NEWLINES_PATTERN = /\n+$/;
const NEWLINE_PATTERN = /\n/g;
// The parser appends " at line 2, column 14:" plus a source excerpt; its line
// numbers count from the frontmatter, not the file, so only the reason is kept.
const ERROR_LOCATION_PATTERN = / at line \d+[\s\S]*$/;

function parse(frontmatter: string | null) {
  const document = parseDocument(frontmatter ?? "");
  const [error] = document.errors;
  if (error) {
    return {
      map: null,
      problem: error.message.replace(ERROR_LOCATION_PATTERN, ""),
    };
  }
  if (document.contents === null) {
    return { map: null, problem: null };
  }
  if (!isMap(document.contents)) {
    return { map: null, problem: "Frontmatter must be a list of keys." };
  }
  return { map: document.contents, problem: null };
}

/** Reads the fields the editor shows as inputs. A field that is missing or not text reads as empty. */
export function readFrontmatterFields(
  frontmatter: string | null
): FrontmatterFields {
  const { map, problem } = parse(frontmatter);
  const read = (key: FrontmatterKey) => {
    const value: unknown = map?.get(key);
    // Block scalars carry their final line break; an input should not.
    return typeof value === "string"
      ? value.replace(TRAILING_NEWLINES_PATTERN, "")
      : "";
  };
  const otherKeys: string[] = [];
  for (const item of map?.items ?? []) {
    const key: unknown = isScalar(item.key) ? item.key.value : null;
    if (typeof key === "string" && key !== "name" && key !== "description") {
      otherKeys.push(key);
    }
  }
  return {
    name: read("name"),
    description: read("description"),
    otherKeys,
    problem,
  };
}

/**
 * Sets one field and returns the new YAML, or null when the YAML cannot be
 * edited safely. Only that field's own text changes: every other key, comment
 * and quote style stays as the author wrote it.
 */
export function writeFrontmatterField(
  frontmatter: string | null,
  key: FrontmatterKey,
  value: string,
  lineEnding: "\n" | "\r\n" = "\n"
): string | null {
  const { map, problem } = parse(frontmatter);
  if (problem !== null) {
    return null;
  }
  const text = frontmatter ?? "";
  const entry = new Document({ [key]: value })
    .toString({ lineWidth: 0 })
    .replace(TRAILING_NEWLINES_PATTERN, "")
    .replace(NEWLINE_PATTERN, lineEnding);

  const pair = map?.items.find(
    (item) => isScalar(item.key) && item.key.value === key
  );
  if (!(pair && isScalar(pair.key) && pair.key.range)) {
    if (text === "") {
      return entry;
    }
    // A name reads first by convention; anything else joins the end.
    return key === "name"
      ? `${entry}${lineEnding}${text}`
      : `${text.replace(TRAILING_NEWLINES_PATTERN, "")}${lineEnding}${entry}`;
  }

  const start = pair.key.range[0];
  const valueRange = isScalar(pair.value) ? pair.value.range : null;
  if (!valueRange) {
    return null;
  }
  const replaced = text.slice(start, valueRange[1]);
  if (replaced.endsWith("\n")) {
    // A block scalar ends with its line break; keep one so the next key stays on its own line.
    return `${text.slice(0, start)}${entry}${lineEnding}${text.slice(valueRange[1])}`;
  }
  const lineEnd = text.indexOf("\n", valueRange[1]);
  const restEnd = lineEnd === -1 ? text.length : lineEnd;
  const rest = text.slice(valueRange[1], restEnd);
  const comment = rest.trim();
  if (comment !== "" && entry.includes("\n")) {
    // A comment after a multi-line value would become part of it: it moves above the key.
    const carriageReturn = rest.endsWith("\r") ? "\r" : "";
    return `${text.slice(0, start)}${comment}${lineEnding}${entry}${carriageReturn}${text.slice(restEnd)}`;
  }
  return `${text.slice(0, start)}${entry}${text.slice(valueRange[1])}`;
}
