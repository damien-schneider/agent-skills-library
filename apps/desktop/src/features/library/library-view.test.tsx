import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseScan } from "@/features/scan/use-scan";
import type { FileContent, FileRow, Root } from "@/lib/ipc-types";

import { LibraryView } from "./library-view";
import type { UseFileContent } from "./use-file-content";
import { useLibraryFile } from "./use-library-file";

interface FilePickerProps {
  files: FileRow[];
  selectedFileId: number | null;
  onSelectFile: (file: FileRow) => void;
}

const mocks = vi.hoisted(() => ({
  indexListeners: new Set<(payload: { fileIds: number[] }) => void>(),
  onIndexUpdated: vi.fn(),
  readFile: vi.fn(),
  listFiles: vi.fn(),
  listRoots: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  readFile: mocks.readFile,
  listFiles: mocks.listFiles,
  listRoots: mocks.listRoots,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));
vi.mock("@/lib/events", () => ({
  onIndexUpdated: mocks.onIndexUpdated,
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
  EditorPane: ({
    editor,
    file,
  }: {
    editor: UseFileContent;
    file: FileRow | null;
  }) => (
    <>
      <output>{file?.path ?? "No file selected"}</output>
      <output aria-label="Loaded file">
        {editor.buffer?.content.fileId ?? "Loading"}
      </output>
      <button
        disabled={!editor.buffer}
        onClick={() => editor.setBody(`${editor.buffer?.body} changed`)}
        type="button"
      >
        Mark unsaved
      </button>
    </>
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
  name: null,
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
const SIMPLIFIED_REVIEWER_ITEM_NAME = /Simplified agents\/reviewer\.md/;

function deferred<T>() {
  let resolveValue: (value: T) => void = () => {
    throw new Error("Deferred promise was not initialized");
  };
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return {
    promise,
    resolve: (value: T) => resolveValue(value),
  };
}

function LibraryHarness() {
  return (
    <LibraryView
      library={useLibraryFile()}
      onOpenSettings={vi.fn()}
      scan={scan}
    />
  );
}

function renderLibrary() {
  return render(<LibraryHarness />);
}

describe("LibraryView", () => {
  beforeEach(() => {
    mocks.indexListeners.clear();
    mocks.onIndexUpdated.mockReset().mockImplementation((listener) => {
      mocks.indexListeners.add(listener);
      return Promise.resolve(() => {
        mocks.indexListeners.delete(listener);
      });
    });
    mocks.listFiles.mockReset().mockResolvedValue([selectedFile]);
    mocks.readFile.mockReset().mockImplementation(
      async (fileId: number) =>
        ({
          fileId,
          path: `/tmp/${fileId}.md`,
          content: "Saved",
          hash: "hash",
          mtimeMs: 0,
          isSymlink: false,
          symlinkTarget: null,
        }) satisfies FileContent
    );
    mocks.listRoots.mockReset().mockResolvedValue([root]);
  });

  it("starts simplified and switches views without losing selection", async () => {
    renderLibrary();

    expect(await screen.findByLabelText("Simplified files")).toBeVisible();
    expect(screen.getByRole("button", { name: "Simplified" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: SIMPLIFIED_ITEM_NAME }));
    expect(screen.getByText(selectedFile.path)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded file")).toHaveTextContent("7")
    );

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
    renderLibrary();
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

  it("protects unsaved edits when another file is selected", async () => {
    const otherFile = {
      ...selectedFile,
      id: 8,
      path: `${root.path}/agents/reviewer.md`,
      relPath: "agents/reviewer.md",
      kind: "claude-agent",
    } satisfies FileRow;
    mocks.listFiles.mockResolvedValue([selectedFile, otherFile]);
    renderLibrary();

    fireEvent.click(
      await screen.findByRole("button", { name: SIMPLIFIED_ITEM_NAME })
    );
    const markUnsaved = screen.getByRole("button", { name: "Mark unsaved" });
    await waitFor(() => expect(markUnsaved).toBeEnabled());
    fireEvent.click(markUnsaved);
    fireEvent.click(
      screen.getByRole("button", {
        name: SIMPLIFIED_REVIEWER_ITEM_NAME,
      })
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText(selectedFile.path)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByText(selectedFile.path)).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: SIMPLIFIED_REVIEWER_ITEM_NAME,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard & open" }));
    expect(screen.getByText(otherFile.path)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded file")).toHaveTextContent("8")
    );
  });

  it("keeps a newer selection when an earlier refresh resolves later", async () => {
    const otherFile = {
      ...selectedFile,
      id: 8,
      path: `${root.path}/agents/reviewer.md`,
      relPath: "agents/reviewer.md",
      kind: "claude-agent",
    } satisfies FileRow;
    mocks.listFiles.mockResolvedValue([selectedFile, otherFile]);
    renderLibrary();
    fireEvent.click(
      await screen.findByRole("button", { name: SIMPLIFIED_ITEM_NAME })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded file")).toHaveTextContent("7")
    );
    await waitFor(() => expect(mocks.indexListeners.size).toBe(2));

    const staleRefresh = deferred<FileRow[]>();
    mocks.listFiles.mockReturnValueOnce(staleRefresh.promise);
    act(() => {
      for (const listener of mocks.indexListeners) {
        listener({ fileIds: [selectedFile.id] });
      }
    });
    await waitFor(() => expect(mocks.listFiles).toHaveBeenCalledTimes(2));
    fireEvent.click(
      screen.getByRole("button", { name: SIMPLIFIED_REVIEWER_ITEM_NAME })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded file")).toHaveTextContent("8")
    );

    await act(async () => {
      staleRefresh.resolve([selectedFile]);
      await Promise.resolve();
    });
    expect(screen.getByText(otherFile.path)).toBeVisible();
    expect(screen.getByLabelText("Loaded file")).toHaveTextContent("8");
  });

  it("keeps a dirty selection editable when its file leaves the index", async () => {
    const otherFile = {
      ...selectedFile,
      id: 8,
      path: `${root.path}/agents/reviewer.md`,
      relPath: "agents/reviewer.md",
      kind: "claude-agent",
    } satisfies FileRow;
    mocks.listFiles.mockResolvedValue([selectedFile, otherFile]);
    renderLibrary();
    fireEvent.click(
      await screen.findByRole("button", { name: SIMPLIFIED_ITEM_NAME })
    );
    const markUnsaved = screen.getByRole("button", { name: "Mark unsaved" });
    await waitFor(() => expect(markUnsaved).toBeEnabled());
    fireEvent.click(markUnsaved);
    await waitFor(() => expect(mocks.indexListeners.size).toBe(2));

    mocks.listFiles.mockResolvedValue([otherFile]);
    act(() => {
      for (const listener of mocks.indexListeners) {
        listener({ fileIds: [selectedFile.id] });
      }
    });
    await waitFor(() => expect(mocks.listFiles).toHaveBeenCalledTimes(2));

    expect(screen.getByText(selectedFile.path)).toBeVisible();
    expect(markUnsaved).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: SIMPLIFIED_REVIEWER_ITEM_NAME })
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Discard & open" }));
    expect(screen.getByText(otherFile.path)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Loaded file")).toHaveTextContent("8")
    );
  });

  it("distinguishes an empty filter result from an empty index", async () => {
    renderLibrary();
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
