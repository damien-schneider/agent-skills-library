import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFavoriteProjects } from "./use-favorite-projects";

const mocks = vi.hoisted(() => ({
  listFavoriteProjects: vi.fn(),
  setProjectFavorite: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  listFavoriteProjects: mocks.listFavoriteProjects,
  setProjectFavorite: mocks.setProjectFavorite,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

describe("useFavoriteProjects", () => {
  beforeEach(() => {
    mocks.listFavoriteProjects.mockReset().mockResolvedValue([]);
    mocks.setProjectFavorite.mockReset().mockResolvedValue(null);
  });

  it("loads and toggles shared project favorites", async () => {
    const projectPath = "/Users/me/project";
    mocks.listFavoriteProjects.mockResolvedValue([
      { path: projectPath, createdAt: 1 },
    ]);
    const { result } = renderHook(() => useFavoriteProjects());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.favoritePaths.has(projectPath)).toBe(true);

    await act(async () => {
      await result.current.toggle(projectPath);
    });

    expect(mocks.setProjectFavorite).toHaveBeenCalledWith(projectPath, false);
    expect(result.current.favoritePaths.has(projectPath)).toBe(false);
  });
});
