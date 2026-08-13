import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { CaptureOverlay } from "./capture-overlay";

const mocks = vi.hoisted(() => ({
  onCaptureError: vi.fn(),
  onCaptureSaved: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  onCaptureError: mocks.onCaptureError,
  onCaptureSaved: mocks.onCaptureSaved,
}));

const capturedPrompt: PromptHistoryEntry = {
  id: 12,
  content: "Summarize this\nterminal output",
  destinationPath: null,
  createdAt: 1_755_000_000_000,
  attachments: [],
};

describe("CaptureOverlay", () => {
  beforeEach(() => {
    mocks.onCaptureError.mockReset().mockResolvedValue(() => undefined);
    mocks.onCaptureSaved.mockReset().mockResolvedValue(() => undefined);
  });

  it("confirms the selected text was saved", async () => {
    render(<CaptureOverlay />);
    await waitFor(() => expect(mocks.onCaptureSaved).toHaveBeenCalledOnce());

    const listener = mocks.onCaptureSaved.mock.calls[0]?.[0];
    if (typeof listener !== "function") {
      throw new Error("Capture listener was not registered");
    }
    act(() => listener(capturedPrompt));

    expect(screen.getByText("Saved to Prompts")).toBeVisible();
    expect(screen.getByText("Summarize this terminal output")).toBeVisible();
  });

  it("limits long capture previews", async () => {
    render(<CaptureOverlay />);
    await waitFor(() => expect(mocks.onCaptureSaved).toHaveBeenCalledOnce());

    const listener = mocks.onCaptureSaved.mock.calls[0]?.[0];
    if (typeof listener !== "function") {
      throw new Error("Capture listener was not registered");
    }
    act(() =>
      listener({
        ...capturedPrompt,
        content: `  ${"x".repeat(130)}\n`,
      })
    );

    expect(screen.getByText(`${"x".repeat(120)}…`)).toBeVisible();
  });

  it("reports when the shortcut has no text selection", async () => {
    render(<CaptureOverlay />);
    await waitFor(() => expect(mocks.onCaptureError).toHaveBeenCalledOnce());

    const listener = mocks.onCaptureError.mock.calls[0]?.[0];
    if (typeof listener !== "function") {
      throw new Error("Capture error listener was not registered");
    }
    act(() => listener({ message: "No text selected" }));

    expect(screen.getByText("Nothing saved")).toBeVisible();
    expect(screen.getByText("No text selected")).toBeVisible();
  });

  it("reports when capture feedback cannot start", async () => {
    mocks.onCaptureError.mockRejectedValueOnce(
      new Error("event bridge unavailable")
    );

    render(<CaptureOverlay />);

    expect(
      await screen.findByText("Capture feedback unavailable")
    ).toBeVisible();
  });
});
