import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { joinFrontmatter, splitFrontmatter } from "../frontmatter";
import { classifyPath, isSkippedDir } from "../scan-targets";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

function collectTargets(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isSkippedDir(entry.name)) {
        collectTargets(path, found);
      }
      continue;
    }
    if (entry.isFile() && classifyPath(path) !== null) {
      found.push(path);
    }
  }
  return found;
}

const corpus = collectTargets(REPO_ROOT);

describe("frontmatter round-trip over the repository corpus", () => {
  it("finds agent config files to check", () => {
    expect(corpus.length).toBeGreaterThan(3);
  });

  it.each(
    corpus.map((path) => relative(REPO_ROOT, path))
  )("rebuilds %s byte for byte", (relPath) => {
    const original = readFileSync(join(REPO_ROOT, relPath), "utf8");

    expect(joinFrontmatter(splitFrontmatter(original))).toBe(original);
  });

  it("keeps the body editable without touching the frontmatter", () => {
    for (const path of corpus) {
      const original = readFileSync(path, "utf8");
      const split = splitFrontmatter(original);
      const edited = joinFrontmatter({ ...split, body: `${split.body}\nedit` });

      expect(edited.startsWith(split.prefix)).toBe(true);
      expect(edited.endsWith("\nedit")).toBe(true);
      expect(splitFrontmatter(edited).frontmatter).toBe(split.frontmatter);
    }
  });

  it("never reports a stat file as an agent target", () => {
    for (const path of corpus) {
      expect(statSync(path).isFile()).toBe(true);
    }
  });
});
