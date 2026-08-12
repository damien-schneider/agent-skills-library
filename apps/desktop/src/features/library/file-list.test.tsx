import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Fragment, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { FileKind, FileRow, Root } from "@/lib/ipc-types";

import { FileList } from "./file-list";

vi.mock("virtua", () => ({
  Virtualizer: ({
    children,
    data,
  }: {
    children: (item: { id: string }) => ReactNode;
    data: { id: string }[];
  }) => data.map((item) => <Fragment key={item.id}>{children(item)}</Fragment>),
}));

const root: Root = {
  id: 1,
  path: "/Users/me/.claude",
  enabled: true,
  addedAt: 0,
};

const REVIEWER_FILE_NAME = /reviewer\.md/i;

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
  it("names nested skills by their skill folders", () => {
    render(
      <FileList
        files={[
          file(
            1,
            "plugins/marketplaces/caveman/skills/caveman/SKILL.md",
            "claude-skill"
          ),
          file(2, "plugins/cache/last30days-skill/SKILL.md", "claude-skill"),
        ]}
        onSelectFile={vi.fn()}
        roots={[root]}
        selectedFileId={null}
      />
    );

    expect(screen.getByText("caveman")).toBeVisible();
    expect(screen.getByText("last30days-skill")).toBeVisible();
    expect(screen.queryAllByText("SKILL.md")).toHaveLength(0);
    expect(
      screen.getByText("plugins/marketplaces/caveman/skills/caveman/SKILL.md")
    ).toBeVisible();
  });

  it("selects a file from the simplified list", () => {
    const onSelectFile = vi.fn();
    const selected = file(3, "agents/reviewer.md", "claude-agent");
    render(
      <FileList
        files={[selected]}
        onSelectFile={onSelectFile}
        roots={[root]}
        selectedFileId={null}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: REVIEWER_FILE_NAME }));

    expect(onSelectFile).toHaveBeenCalledWith(selected);
  });
});
