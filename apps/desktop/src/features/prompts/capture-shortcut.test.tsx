import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureShortcut } from "./capture-shortcut";

const mocks = vi.hoisted(() => ({
  captureAccessStatus: vi.fn(),
  onCaptureAccessChanged: vi.fn(),
  onCaptureShortcutProgress: vi.fn(),
  requestCaptureAccess: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  onCaptureAccessChanged: mocks.onCaptureAccessChanged,
  onCaptureShortcutProgress: mocks.onCaptureShortcutProgress,
}));
vi.mock("@/lib/ipc", () => ({
  captureAccessStatus: mocks.captureAccessStatus,
  requestCaptureAccess: mocks.requestCaptureAccess,
}));

const ALLOW_ACCESS = "Allow access";

describe("CaptureShortcut", () => {
  beforeEach(() => {
    mocks.captureAccessStatus
      .mockReset()
      .mockResolvedValue({ supported: true, granted: true });
    mocks.onCaptureAccessChanged.mockReset().mockResolvedValue(() => undefined);
    mocks.onCaptureShortcutProgress
      .mockReset()
      .mockResolvedValue(() => undefined);
    mocks.requestCaptureAccess.mockReset();
  });

  it("fills each shortcut key as the double tap progresses", async () => {
    const { container } = render(<CaptureShortcut />);
    expect(await screen.findByText("Ready")).toBeVisible();

    const listener = mocks.onCaptureShortcutProgress.mock.calls[0]?.[0];
    if (typeof listener !== "function") {
      throw new Error("Shortcut progress listener was not registered");
    }
    act(() => listener({ completedTaps: 1 }));
    expect(container.querySelectorAll('[data-completed="true"]')).toHaveLength(
      1
    );

    act(() => listener({ completedTaps: 2 }));
    expect(container.querySelectorAll('[data-completed="true"]')).toHaveLength(
      2
    );
  });

  it("asks for the missing permission, then reports the shortcut ready", async () => {
    mocks.captureAccessStatus.mockResolvedValue({
      supported: true,
      granted: false,
    });
    mocks.requestCaptureAccess.mockResolvedValue({
      supported: true,
      granted: true,
    });
    render(<CaptureShortcut />);

    fireEvent.click(await screen.findByRole("button", { name: ALLOW_ACCESS }));

    expect(await screen.findByText("Ready")).toBeVisible();
    expect(mocks.requestCaptureAccess).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: ALLOW_ACCESS })
    ).not.toBeInTheDocument();
  });

  it("says so in place when the settings cannot be opened", async () => {
    mocks.captureAccessStatus.mockResolvedValue({
      supported: true,
      granted: false,
    });
    mocks.requestCaptureAccess.mockRejectedValue(new Error("denied"));
    render(<CaptureShortcut />);

    fireEvent.click(await screen.findByRole("button", { name: ALLOW_ACCESS }));

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: ALLOW_ACCESS })).toBeEnabled();
  });

  it("stays out of the way where capture is not supported", async () => {
    mocks.captureAccessStatus.mockResolvedValue({
      supported: false,
      granted: false,
    });
    const { container } = render(<CaptureShortcut />);

    await act(async () => {
      await mocks.captureAccessStatus.mock.results[0]?.value;
    });

    expect(container).toBeEmptyDOMElement();
  });
});
