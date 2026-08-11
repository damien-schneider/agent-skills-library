import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  mocks.readFile.mockReset();
  mocks.writeFile.mockReset();
  mocks.readFile.mockResolvedValue({
    fileId: 7,
    path: "/skills/example/SKILL.md",
    content: ORIGINAL_CONTENT,
    hash: "original-hash",
    mtimeMs: 1,
    isSymlink: false,
    symlinkTarget: null,
  });
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
      "original-hash"
    );
    expect(result.current.dirty).toBe(false);
  });
});
