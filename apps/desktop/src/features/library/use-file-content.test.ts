import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileContent } from "@/lib/ipc-types";

import { useFileContent } from "./use-file-content";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  onIndexUpdated: () => Promise.resolve(() => undefined),
}));

vi.mock("@/lib/ipc", () => ({
  readFile: mocks.readFile,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
  writeFile: mocks.writeFile,
}));

const ORIGINAL_CONTENT = "# Original\n\nBody";

function fileContent(fileId: number): FileContent {
  return {
    fileId,
    path: `/skills/${fileId}/SKILL.md`,
    content: ORIGINAL_CONTENT,
    hash: `hash-${fileId}`,
    mtimeMs: 1,
    isSymlink: false,
    symlinkTarget: null,
  };
}

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

beforeEach(() => {
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
  it("derives dirty state from the current document", async () => {
    const { result } = renderHook(() => useFileContent(7));

    await waitFor(() => {
      expect(result.current.buffer).not.toBeNull();
    });

    act(() => result.current.setBody("# Changed\n\nBody"));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.setBody(ORIGINAL_CONTENT));
    expect(result.current.dirty).toBe(false);
  });

  it("writes only after an explicit save with changes", async () => {
    const { result } = renderHook(() => useFileContent(7));

    await waitFor(() => {
      expect(result.current.buffer).not.toBeNull();
    });

    await act(async () => result.current.save());
    expect(mocks.writeFile).not.toHaveBeenCalled();

    act(() => result.current.setBody("# Changed\n\nBody"));
    expect(mocks.writeFile).not.toHaveBeenCalled();

    await act(async () => result.current.save());
    expect(mocks.writeFile).toHaveBeenCalledOnce();
    expect(mocks.writeFile).toHaveBeenCalledWith(
      7,
      "# Changed\n\nBody",
      "hash-7"
    );
    expect(result.current.dirty).toBe(false);
  });

  it("drops the previous file state as soon as selection changes", async () => {
    const { result, rerender } = renderHook(
      ({ fileId }) => useFileContent(fileId),
      { initialProps: { fileId: 7 } }
    );

    await waitFor(() => {
      expect(result.current.buffer?.content.fileId).toBe(7);
    });
    act(() => result.current.setBody("# Changed\n\nBody"));
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
    const firstRead = deferred<FileContent>();
    const secondRead = deferred<FileContent>();
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
