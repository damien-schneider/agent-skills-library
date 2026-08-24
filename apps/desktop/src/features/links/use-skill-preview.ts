import { parseSkillMarkdown } from "@skills-agent-library/skills-core/skill-parser";
import { useEffect, useState } from "react";

import { readFile } from "@/lib/ipc";
import type { FileRow } from "@/lib/ipc-types";

export interface SkillPreview {
  description: string;
  excerpt: string;
}

const EXCERPT_LENGTH = 220;
const HEADING_OR_LIST_MARKER = /^[#>\-*\s]+/;

const cache = new Map<string, SkillPreview>();

function excerptOf(markdown: string): string {
  const paragraph = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
  if (!paragraph) {
    return "";
  }
  const text = paragraph.replace(HEADING_OR_LIST_MARKER, "");
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH)}…`
    : text;
}

/** Keyed by content hash, so an edited file previews its new text without a manual purge. */
export function useSkillPreview(file: FileRow): SkillPreview | null {
  const key = `${file.id}:${file.hash}`;
  const [preview, setPreview] = useState<SkillPreview | null>(
    () => cache.get(key) ?? null
  );

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setPreview(cached);
      return;
    }

    let cancelled = false;
    readFile(file.id)
      .then(({ content }) => {
        const parsed = parseSkillMarkdown(content);
        const next: SkillPreview = {
          description: parsed.description,
          excerpt: excerptOf(parsed.markdown),
        };
        cache.set(key, next);
        if (!cancelled) {
          setPreview(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.id, key]);

  return preview;
}
