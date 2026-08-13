import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseScan } from "@/features/scan/use-scan";
import type { FileRow, Root } from "@/lib/ipc-types";

import { LibraryView } from "./library-view";

interface FilePickerProps {
  files: FileRow[];
  selectedFileId: number | null;
  onSelectFile: (file: FileRow) => void;
}

const mocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  listRoots: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  listFiles: mocks.listFiles,
  listRoots: mocks.listRoots,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));
vi.mock("@/lib/events", () => ({
  onIndexUpdated: vi.fn().mockResolvedValue(() => undefined),
}));
vi.mock("@/features/projects/use-favorite-projects", () => ({
  useFavoriteProjects: () => ({
    favoritePaths: new Set<string>(),
    toggle: vi.fn(),
  }),
}));
vi.mock("@/features/scan/scan-status", () => ({
  ScanStatus: () => <span>Scan ready</span>,
}));
vi.mock("./editor-pane", () => ({
  EditorPane: ({ file }: { file: FileRow | null }) => (
    <output>{file?.path ?? "No file selected"}</output>
  ),
}));
vi.mock("./file-tree", () => ({
  FileTree: ({ files, selectedFileId, onSelectFile }: FilePickerProps) => (
    <section aria-label="Tree files">
      {files.map((file) => (
        <button
          aria-pressed={selectedFileId === file.id}
          key={file.id}
          onClick={() => onSelectFile(file)}
          type="button"
        >
          Tree {file.relPath}
        </button>
      ))}
    </section>
  ),
}));
vi.mock("./file-list", () => ({
  FileList: ({ files, selectedFileId, onSelectFile }: FilePickerProps) => (
    <section aria-label="Simplified files">
      {files.map((file) => (
        <button
          aria-pressed={selectedFileId === file.id}
          key={file.id}
          onClick={() => onSelectFile(file)}
          type="button"
        >
          Simplified {file.relPath}
        </button>
      ))}
    </section>
  ),
}));

const root: Root = {
  id: 1,
  path: "/Users/me/.claude",
  enabled: true,
  addedAt: 0,
};

const selectedFile: FileRow = {
  id: 7,
  rootId: root.id,
  path: `${root.path}/plugins/caveman/SKILL.md`,
  relPath: "plugins/caveman/SKILL.md",
  kind: "claude-skill",
  projectDir: null,
  size: 1,
  mtimeNs: 1,
  hash: "hash",
  isSymlink: false,
  symlinkTarget: null,
  firstSeenAt: 0,
  lastSeenScanId: 1,
  deletedAt: null,
};

const scan: UseScan = {
  running: false,
  stats: null,
  lastResult: null,
  error: null,
  start: vi.fn(),
  cancel: vi.fn(),
};

const SIMPLIFIED_ITEM_NAME = /Simplified plugins\/caveman\/SKILL\.md/;
const TREE_ITEM_NAME = /Tree plugins\/caveman\/SKILL\.md/;
const REVIEWER_PATH = /agents\/reviewer\.md/;

describe("LibraryView", () => {
  beforeEach(() => {
    mocks.listFiles.mockReset().mockResolvedValue([selectedFile]);
    mocks.listRoots.mockReset().mockResolvedValue([root]);
  });

  it("starts simplified and switches views without losing selection", async () => {
    render(<LibraryView scan={scan} />);

    expect(await screen.findByLabelText("Simplified files")).toBeVisible();
    expect(screen.getByRole("button", { name: "Simplified" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: SIMPLIFIED_ITEM_NAME }));
    expect(screen.getByText(selectedFile.path)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(screen.getByLabelText("Tree files")).toBeVisible();
    expect(
      screen.getByRole("button", { name: TREE_ITEM_NAME })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the path filter when changing views", async () => {
    const otherFile = {
      ...selectedFile,
      id: 8,
      path: `${root.path}/agents/reviewer.md`,
      relPath: "agents/reviewer.md",
      kind: "claude-agent",
    } satisfies FileRow;
    mocks.listFiles.mockResolvedValue([selectedFile, otherFile]);
    render(<LibraryView scan={scan} />);
    await waitFor(() => expect(mocks.listFiles).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("Filter files by path"), {
      target: { value: "caveman" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simplified" }));

    expect(
      screen.getByRole("button", { name: SIMPLIFIED_ITEM_NAME })
    ).toBeVisible();
    expect(screen.queryByText(REVIEWER_PATH)).not.toBeInTheDocument();
  });

  it("distinguishes an empty filter result from an empty index", async () => {
    render(<LibraryView scan={scan} />);
    await waitFor(() => expect(mocks.listFiles).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("Filter files by path"), {
      target: { value: "missing" },
    });

    expect(screen.getByText("No files match this filter.")).toBeVisible();
    expect(
      screen.queryByText("Nothing indexed yet — add a root and run a scan.")
    ).not.toBeInTheDocument();
  });
});
