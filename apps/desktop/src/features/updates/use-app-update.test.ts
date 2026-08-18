import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppUpdate } from "./use-app-update";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-log", () => ({ warn: mocks.warn }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));

const TEN_MINUTES_MS = 10 * 60 * 1000;
let now = 1_000_000;

beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  mocks.check.mockReset();
  mocks.relaunch.mockReset();
  mocks.warn.mockReset();
  mocks.check
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ version: "0.0.7" });
  mocks.warn.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAppUpdate", () => {
  it("checks for updates on focus at most once every ten minutes", async () => {
    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => expect(mocks.check).toHaveBeenCalledOnce());

    now += TEN_MINUTES_MS - 1;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(mocks.check).toHaveBeenCalledOnce();

    now += 1;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(mocks.check).toHaveBeenCalledTimes(2);
      expect(result.current.pending?.version).toBe("0.0.7");
    });
  });
});
