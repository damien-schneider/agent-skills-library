import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppReloadShortcut } from "./use-app-reload-shortcut";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAppReloadShortcut", () => {
  it("reloads the app for Command-R", () => {
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => undefined);
    renderHook(() => useAppReloadShortcut());

    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      key: "r",
      metaKey: true,
    });

    expect(window.dispatchEvent(event)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
});
