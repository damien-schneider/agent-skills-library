import { describe, expect, it } from "vitest";

import type { DestinationFolder } from "@/lib/ipc-types";
import {
  destinationParts,
  destinationSections,
  displayPath,
} from "./destination-path";

const HOME = "/Users/me";

function folder(
  path: string,
  overrides: Partial<DestinationFolder> = {}
): DestinationFolder {
  return {
    path,
    favorite: false,
    lastUsedAt: null,
    fileCount: 0,
    available: true,
    ...overrides,
  };
}

describe("displayPath", () => {
  it("shortens the home directory without touching a lookalike sibling", () => {
    expect(displayPath("/Users/me/GitHub/app", HOME)).toBe("~/GitHub/app");
    expect(displayPath("/Users/me", HOME)).toBe("~");
    expect(displayPath("/Users/meow/app", HOME)).toBe("/Users/meow/app");
    expect(displayPath("/Users/me/GitHub/app", null)).toBe(
      "/Users/me/GitHub/app"
    );
  });
});

describe("destinationParts", () => {
  it("keeps the folder name apart from the tree above it", () => {
    expect(destinationParts("/Users/me/GitHub/app", HOME)).toEqual({
      name: "app",
      parent: "~/GitHub",
    });
    expect(destinationParts("/opt", null)).toEqual({ name: "opt", parent: "" });
  });
});

describe("destinationSections", () => {
  it("sorts each source into its own section", () => {
    const sections = destinationSections(
      [
        folder("/repo/starred", { favorite: true }),
        folder("/repo/used", { lastUsedAt: 10 }),
        folder("/repo/indexed", { fileCount: 4 }),
      ],
      "",
      null
    );

    expect(sections.map((section) => section.id)).toEqual([
      "favorite",
      "recent",
      "project",
    ]);
    expect(sections[1]?.folders[0]?.path).toBe("/repo/used");
  });

  it("keeps a starred folder that vanished but drops a stale indexed one", () => {
    const sections = destinationSections(
      [
        folder("/repo/starred", { favorite: true, available: false }),
        folder("/repo/indexed", { available: false, fileCount: 2 }),
      ],
      "",
      null
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]?.folders[0]?.path).toBe("/repo/starred");
  });

  it("matches every word against the shortened path", () => {
    const folders = [
      folder("/Users/me/GitHub/skills-agent-library", { fileCount: 1 }),
      folder("/Users/me/Documents/skills", { fileCount: 1 }),
    ];

    expect(
      destinationSections(folders, "github skills", HOME)[0]?.folders
    ).toHaveLength(1);
    expect(destinationSections(folders, "~/doc", HOME)[0]?.folders).toEqual([
      folders[1],
    ]);
    expect(destinationSections(folders, "nothing", HOME)).toEqual([]);
  });

  it("finds a folder from a path pasted in full", () => {
    const folders = [folder("/Users/me/GitHub/app", { fileCount: 1 })];

    expect(
      destinationSections(folders, "/Users/me/GitHub/app", HOME)[0]?.folders
    ).toEqual(folders);
  });

  it("caps the browsing list and reports what it left out", () => {
    const projects = Array.from({ length: 12 }, (_, index) =>
      folder(`/repo/project-${index}`, { fileCount: index })
    );

    const browsing = destinationSections(projects, "", null)[0];
    expect(browsing?.folders).toHaveLength(8);
    expect(browsing?.hidden).toBe(4);
    expect(browsing?.folders[0]?.path).toBe("/repo/project-11");

    expect(destinationSections(projects, "project", null)[0]?.hidden).toBe(0);
  });
});
