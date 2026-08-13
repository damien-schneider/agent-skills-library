import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FileKind, FileRow, Root } from "@/lib/ipc-types";

import { FileList } from "./file-list";

const root: Root = {
  id: 1,
  path: "/Users/me/.claude",
  enabled: true,
  addedAt: 0,
};

const CAVEMAN_FILE_NAME = /caveman\s+Claude skill/;
const REVIEWER_FILE_NAME = /reviewer\.md/i;
const SKILLS_GROUP_NAME = /skills/;
const AGENTS_GROUP_NAME = /Toggle agents/;

function file(id: number, relPath: string, kind: FileKind): FileRow {
  return {
    id,
    rootId: root.id,
    path: `${root.path}/${relPath}`,
    relPath,
    kind,
    projectDir: null,
    size: 1,
    mtimeNs: 1,
    hash: `h${id}`,
    isSymlink: false,
    symlinkTarget: null,
    firstSeenAt: 0,
    lastSeenScanId: 1,
    deletedAt: null,
  };
}

describe("FileList", () => {
  it("collapses skills from the same folder into one collection", () => {
    render(
      <FileList
        files={[
          file(1, "skills/caveman/SKILL.md", "claude-skill"),
          file(2, "skills/last30days/SKILL.md", "claude-skill"),
          file(3, "agents/reviewer.md", "claude-agent"),
        ]}
        onSelectFile={vi.fn()}
        roots={[root]}
        selectedFileId={null}
      />
    );

    const skillsGroup = screen.getByRole("button", { name: SKILLS_GROUP_NAME });
    expect(skillsGroup).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: CAVEMAN_FILE_NAME })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: REVIEWER_FILE_NAME })
    ).toBeVisible();

    fireEvent.click(skillsGroup);

    expect(skillsGroup).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: CAVEMAN_FILE_NAME })
    ).toBeVisible();
    expect(screen.getByText("last30days")).toBeVisible();
  });

  it("keeps singleton folders compact instead of adding another toggle", () => {
    render(
      <FileList
        files={[file(3, "agents/reviewer.md", "claude-agent")]}
        onSelectFile={vi.fn()}
        roots={[root]}
        selectedFileId={null}
      />
    );

    expect(
      screen.getByRole("button", { name: REVIEWER_FILE_NAME })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: AGENTS_GROUP_NAME })
    ).toBeNull();
  });

  it("expands a selected file and preserves selection", () => {
    const onSelectFile = vi.fn();
    const selected = file(3, "skills/caveman/SKILL.md", "claude-skill");
    const { rerender } = render(
      <FileList
        files={[
          selected,
          file(4, "skills/last30days/SKILL.md", "claude-skill"),
        ]}
        onSelectFile={onSelectFile}
        roots={[root]}
        selectedFileId={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: SKILLS_GROUP_NAME }));
    fireEvent.click(screen.getByRole("button", { name: CAVEMAN_FILE_NAME }));
    expect(onSelectFile).toHaveBeenCalledWith(selected);

    rerender(
      <FileList
        files={[
          selected,
          file(4, "skills/last30days/SKILL.md", "claude-skill"),
        ]}
        onSelectFile={onSelectFile}
        roots={[root]}
        selectedFileId={selected.id}
      />
    );

    expect(
      screen.getByRole("button", { name: CAVEMAN_FILE_NAME })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("expands every matching group while filtering", () => {
    render(
      <FileList
        expandAll={true}
        files={[
          file(1, "skills/caveman/SKILL.md", "claude-skill"),
          file(2, "skills/last30days/SKILL.md", "claude-skill"),
        ]}
        onSelectFile={vi.fn()}
        roots={[root]}
        selectedFileId={null}
      />
    );

    expect(
      screen.getByRole("button", { name: CAVEMAN_FILE_NAME })
    ).toBeVisible();
  });
});
