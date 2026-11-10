import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileContent, IndexUpdatedEvent } from "@/lib/ipc-types";

import { useFileContent } from "./use-file-content";

type IndexListener = (payload: IndexUpdatedEvent) => void;

const mocks = vi.hoisted(() => ({
  indexListeners: new Set<(payload: { fileIds: number[] }) => void>(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  onIndexUpdated: (listener: IndexListener) => {
    mocks.indexListeners.add(listener);
    return Promise.resolve(() => {
      mocks.indexListeners.delete(listener);
    });
  },
}));

// The backend rejects with a `{ code, message }` payload, which is all the hook reads.
vi.mock("@/lib/ipc", () => ({
  readFile: mocks.readFile,
  toIpcError: (cause: unknown) => cause,
  writeFile: mocks.writeFile,
}));

const FRONTMATTER =
  "---\nname: pdf\ndescription: Fill PDF forms. # keep me\nlicense: MIT\n---\n";
const ORIGINAL_BODY = "# Original\n\nBody\n";
const CHANGED_BODY = "# Changed\n\nBody\n";
const ORIGINAL_CONTENT = `${FRONTMATTER}${ORIGINAL_BODY}`;
const EXTERNAL_CONTENT = `${FRONTMATTER}# Edited elsewhere\n`;

function fileContent(
  fileId: number,
  overrides: Partial<FileContent> = {}
): FileContent {
  return {
    fileId,
    path: `/skills/${fileId}/SKILL.md`,
    content: ORIGINAL_CONTENT,
    hash: `hash-${fileId}`,
    mtimeMs: 1,
    isSymlink: false,
    symlinkTarget: null,
    ...overrides,
  };
}

async function openFile(fileId = 7) {
  const rendered = renderHook(() => useFileContent(fileId));
  await waitFor(() => {
    expect(rendered.result.current.loading).toBe(false);
  });
  return rendered;
}

/** The index announces that files changed; the hook then re-reads the open one. */
async function announceIndexUpdate(fileIds: number[]) {
  const readsBefore = mocks.readFile.mock.calls.length;
  await act(async () => {
    for (const listener of mocks.indexListeners) {
      listener({ fileIds });
    }
    await vi.waitFor(() => {
      if (mocks.readFile.mock.calls.length <= readsBefore) {
        throw new Error("the open file was not read again");
      }
    });
  });
}

beforeEach(() => {
  mocks.indexListeners.clear();
  mocks.readFile.mockReset();
  mocks.writeFile.mockReset();
  mocks.readFile.mockImplementation(async (fileId: number) =>
    fileContent(fileId)
  );
  mocks.writeFile.mockResolvedValue({
    fileId: 7,
    hash: "saved-hash",
    mtimeMs: 2,
    size: 24,
  });
});

describe("useFileContent", () => {
  it("loads the file into a clean visual document", async () => {
    const { result } = await openFile();

    expect(result.current.buffer?.content.path).toBe("/skills/7/SKILL.md");
    expect(result.current.buffer?.body).toBe(ORIGINAL_BODY);
    expect(result.current.mode).toBe("rich");
    expect(result.current.documentText).toBe(ORIGINAL_CONTENT);
    expect(result.current.dirty).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports a file that cannot be read", async () => {
    mocks.readFile.mockRejectedValue({ code: "io", message: "Gone" });
    const { result } = await openFile();

    expect(result.current.buffer).toBeNull();
    expect(result.current.error).toBe("Gone");
  });

  it("becomes dirty on a body edit and saves the body merged with its frontmatter", async () => {
    const { result } = await openFile();

    await act(async () => {
      await result.current.save();
    });
    expect(mocks.writeFile).not.toHaveBeenCalled();

    act(() => result.current.setBody(CHANGED_BODY));
    expect(result.current.dirty).toBe(true);
    expect(mocks.writeFile).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.save();
    });
    expect(mocks.writeFile).toHaveBeenCalledOnce();
    expect(mocks.writeFile).toHaveBeenCalledWith(
      7,
      `${FRONTMATTER}${CHANGED_BODY}`,
      "hash-7"
    );
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setBody(ORIGINAL_BODY));
    expect(result.current.dirty).toBe(true);
  });

  it("does not reload when the index reports its own save", async () => {
    const { result } = await openFile();
    act(() => result.current.setBody(CHANGED_BODY));
    await act(async () => {
      await result.current.save();
    });
    const { revision } = result.current;
    mocks.readFile.mockResolvedValue(
      fileContent(7, {
        content: `${FRONTMATTER}${CHANGED_BODY}`,
        hash: "saved-hash",
      })
    );

    await announceIndexUpdate([7]);

    expect(result.current.revision).toBe(revision);
    expect(result.current.changedOnDisk).toBe(false);
    expect(result.current.dirty).toBe(false);
    expect(result.current.documentText).toBe(`${FRONTMATTER}${CHANGED_BODY}`);
  });

  it("follows an external change while the document is clean", async () => {
    const { result } = await openFile();
    const { revision } = result.current;
    mocks.readFile.mockResolvedValue(
      fileContent(7, { content: EXTERNAL_CONTENT, hash: "external-hash" })
    );

    await announceIndexUpdate([7]);

    expect(result.current.documentText).toBe(EXTERNAL_CONTENT);
    expect(result.current.revision).toBeGreaterThan(revision);
    expect(result.current.dirty).toBe(false);
    expect(result.current.changedOnDisk).toBe(false);
  });

  it("keeps unsaved edits and flags an external change while dirty", async () => {
    const { result } = await openFile();
    act(() => result.current.setBody(CHANGED_BODY));
    mocks.readFile.mockResolvedValue(
      fileContent(7, { content: EXTERNAL_CONTENT, hash: "external-hash" })
    );

    await announceIndexUpdate([7]);

    expect(result.current.changedOnDisk).toBe(true);
    expect(result.current.documentText).toBe(`${FRONTMATTER}${CHANGED_BODY}`);

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.changedOnDisk).toBe(false);
    expect(result.current.documentText).toBe(EXTERNAL_CONTENT);
  });

  it("ignores index updates for other files", async () => {
    const { result } = await openFile();
    const { revision } = result.current;

    act(() => {
      for (const listener of mocks.indexListeners) {
        listener({ fileIds: [8] });
      }
    });

    expect(mocks.readFile).toHaveBeenCalledOnce();
    expect(result.current.revision).toBe(revision);
  });

  it("reports a conflict on save, then overwrites against the disk's hash", async () => {
    const { result } = await openFile();
    act(() => result.current.setBody(CHANGED_BODY));
    mocks.writeFile.mockRejectedValueOnce({
      code: "conflict",
      message: "Changed on disk",
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.save();
    });
    expect(saved).toBe(false);
    expect(result.current.conflict).toBe(true);
    expect(result.current.dirty).toBe(true);
    expect(result.current.error).toBeNull();

    mocks.readFile.mockResolvedValue(
      fileContent(7, { content: EXTERNAL_CONTENT, hash: "external-hash" })
    );
    await act(async () => {
      await result.current.overwrite();
    });
    expect(mocks.writeFile).toHaveBeenLastCalledWith(
      7,
      `${FRONTMATTER}${CHANGED_BODY}`,
      "external-hash"
    );
    expect(result.current.conflict).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it("lets a conflict be dismissed without losing the edits", async () => {
    const { result } = await openFile();
    act(() => result.current.setBody(CHANGED_BODY));
    mocks.writeFile.mockRejectedValueOnce({
      code: "conflict",
      message: "Changed on disk",
    });
    await act(async () => {
      await result.current.save();
    });

    act(() => result.current.dismissConflict());

    expect(result.current.conflict).toBe(false);
    expect(result.current.dirty).toBe(true);
  });

  it("edits only the YAML line of the field that changed", async () => {
    const { result } = await openFile();

    let accepted = false;
    act(() => {
      accepted = result.current.setFrontmatterField("name", "pdf-forms");
    });

    expect(accepted).toBe(true);
    expect(result.current.documentText).toBe(
      ORIGINAL_CONTENT.replace("name: pdf\n", "name: pdf-forms\n")
    );
    expect(result.current.dirty).toBe(true);
  });

  it("adds a frontmatter block when a field is set on a file without one", async () => {
    mocks.readFile.mockResolvedValue(
      fileContent(7, { content: ORIGINAL_BODY })
    );
    const { result } = await openFile();

    act(() => {
      result.current.setFrontmatterField("name", "pdf");
    });

    expect(result.current.documentText).toBe(
      `---\nname: pdf\n---\n${ORIGINAL_BODY}`
    );
  });

  it("refuses a field edit when the frontmatter is not valid YAML", async () => {
    mocks.readFile.mockResolvedValue(
      fileContent(7, {
        content: `---\ndescription: Driving: a browser\n---\n${ORIGINAL_BODY}`,
      })
    );
    const { result } = await openFile();

    let accepted = true;
    act(() => {
      accepted = result.current.setFrontmatterField("name", "pdf");
    });

    expect(accepted).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it("carries edits through a switch to source and back", async () => {
    const { result } = await openFile();
    act(() => result.current.setBody(CHANGED_BODY));

    let switched = false;
    act(() => {
      switched = result.current.setMode("raw");
    });
    expect(switched).toBe(true);
    expect(result.current.mode).toBe("raw");
    expect(result.current.documentText).toBe(`${FRONTMATTER}${CHANGED_BODY}`);

    const sourceText = `${FRONTMATTER.replace("pdf", "pdf-forms")}# From source\n`;
    act(() => result.current.setRaw(sourceText));
    expect(result.current.documentText).toBe(sourceText);

    const { revision } = result.current;
    act(() => {
      switched = result.current.setMode("rich");
    });
    expect(switched).toBe(true);
    expect(result.current.mode).toBe("rich");
    expect(result.current.buffer?.body).toBe("# From source\n");
    expect(result.current.documentText).toBe(sourceText);
    expect(result.current.revision).toBeGreaterThan(revision);
    expect(result.current.dirty).toBe(true);
  });

  it("continues in source with the same text once the visual editor is abandoned", async () => {
    const { result } = await openFile();
    act(() => result.current.setBody(CHANGED_BODY));

    act(() => result.current.abandonRich());

    expect(result.current.mode).toBe("raw");
    expect(result.current.documentText).toBe(`${FRONTMATTER}${CHANGED_BODY}`);
    let switched = true;
    act(() => {
      switched = result.current.setMode("rich");
    });
    expect(switched).toBe(true);
    expect(result.current.mode).toBe("rich");
  });

  it("drops the previous file state as soon as selection changes", async () => {
    const { result, rerender } = renderHook(
      ({ fileId }) => useFileContent(fileId),
      { initialProps: { fileId: 7 } }
    );

    await waitFor(() => {
      expect(result.current.buffer?.content.fileId).toBe(7);
    });
    act(() => result.current.setBody(CHANGED_BODY));
    expect(result.current.dirty).toBe(true);

    rerender({ fileId: 8 });
    expect(result.current.buffer).toBeNull();
    expect(result.current.dirty).toBe(false);
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.buffer?.content.fileId).toBe(8);
    });
  });

  it("ignores a stale file read that finishes after the next selection", async () => {
    const firstRead = Promise.withResolvers<FileContent>();
    const secondRead = Promise.withResolvers<FileContent>();
    mocks.readFile.mockImplementation((fileId: number) =>
      fileId === 7 ? firstRead.promise : secondRead.promise
    );
    const { result, rerender } = renderHook(
      ({ fileId }) => useFileContent(fileId),
      { initialProps: { fileId: 7 } }
    );
    await waitFor(() => expect(mocks.readFile).toHaveBeenCalledWith(7));

    rerender({ fileId: 8 });
    await waitFor(() => expect(mocks.readFile).toHaveBeenCalledWith(8));

    await act(async () => {
      secondRead.resolve(fileContent(8));
      await Promise.resolve();
    });
    expect(result.current.buffer?.content.fileId).toBe(8);

    await act(async () => {
      firstRead.resolve(fileContent(7));
      await Promise.resolve();
    });
    expect(result.current.buffer?.content.fileId).toBe(8);
  });
});
