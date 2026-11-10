import "@testing-library/jest-dom/vitest";
import { Update } from "@tauri-apps/plugin-updater";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { UseScan } from "@/features/scan/use-scan";
import type { UseAppUpdate } from "@/features/updates/use-app-update";
import type { Root } from "@/lib/ipc-types";

import { SettingsView } from "./settings-view";

const mocks = vi.hoisted(() => ({
  addRoot: vi.fn(),
  getVersion: vi.fn(),
  getWatcherStatus: vi.fn(),
  homeDir: vi.fn(),
  listFiles: vi.fn(),
  listRoots: vi.fn(),
  openFolderDialog: vi.fn(),
  removeRoot: vi.fn(),
  setRootEnabled: vi.fn(),
  setWatcherEnabled: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({ getVersion: mocks.getVersion }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: mocks.homeDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.openFolderDialog }));
vi.mock("@/lib/events", () => ({
  onIndexUpdated: () => Promise.resolve(() => undefined),
}));
// The backend rejects with a `{ code, message }` payload, which is all the view reads.
vi.mock("@/lib/ipc", () => ({
  addRoot: mocks.addRoot,
  getWatcherStatus: mocks.getWatcherStatus,
  listFiles: mocks.listFiles,
  listRoots: mocks.listRoots,
  removeRoot: mocks.removeRoot,
  setRootEnabled: mocks.setRootEnabled,
  setWatcherEnabled: mocks.setWatcherEnabled,
  toIpcError: (cause: unknown) => cause,
}));

const GITHUB: Root = {
  id: 1,
  path: "/Users/me/GitHub",
  enabled: true,
  addedAt: 0,
};
const WORK: Root = { id: 7, path: "/Users/me/work", enabled: true, addedAt: 1 };

function scan(overrides: Partial<UseScan> = {}): UseScan {
  return {
    running: false,
    stats: null,
    lastResult: null,
    error: null,
    start: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function update(overrides: Partial<UseAppUpdate> = {}): UseAppUpdate {
  return {
    pending: null,
    installing: false,
    checking: false,
    lastCheckedAt: null,
    check: vi.fn().mockResolvedValue({ status: "up-to-date" }),
    install: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function renderSettings(
  props: { scan?: UseScan; update?: UseAppUpdate } = {}
) {
  const view = {
    scan: props.scan ?? scan(),
    update: props.update ?? update(),
    onFoldersChanged: vi.fn(),
  };
  const { rerender } = render(<SettingsView {...view} />);
  await screen.findByText("~/GitHub");
  return {
    ...view,
    rerender: (next: UseScan) =>
      rerender(<SettingsView {...view} scan={next} />),
  };
}

// happy-dom has no Web Animations, which the page's scroll area asks for.
beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
});

describe("SettingsView", () => {
  beforeEach(() => {
    mocks.homeDir.mockReset().mockResolvedValue("/Users/me");
    mocks.getVersion.mockReset().mockResolvedValue("1.2.3");
    mocks.listRoots.mockReset().mockResolvedValue([GITHUB]);
    mocks.listFiles
      .mockReset()
      .mockResolvedValue([{ rootId: 1 }, { rootId: 1 }]);
    mocks.getWatcherStatus
      .mockReset()
      .mockResolvedValue({ enabled: true, running: true });
    mocks.setWatcherEnabled
      .mockReset()
      .mockResolvedValue({ enabled: false, running: false });
    mocks.addRoot.mockReset().mockResolvedValue(WORK);
    mocks.removeRoot.mockReset().mockResolvedValue(null);
    mocks.setRootEnabled.mockReset().mockResolvedValue(null);
    mocks.openFolderDialog.mockReset().mockResolvedValue(WORK.path);
  });

  it("lists each folder with how many files it holds", async () => {
    await renderSettings();

    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Index ~/GitHub" })
    ).toBeChecked();
  });

  it("indexes a folder as soon as it is added", async () => {
    const view = await renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Add folder…" }));

    await waitFor(() => expect(view.scan.start).toHaveBeenCalledWith([7]));
    expect(mocks.addRoot).toHaveBeenCalledWith("/Users/me/work");
    expect(view.onFoldersChanged).toHaveBeenCalled();
  });

  it("waits for the running scan before indexing a new folder", async () => {
    const running = scan({ running: true });
    const view = await renderSettings({ scan: running });

    fireEvent.click(screen.getByRole("button", { name: "Add folder…" }));
    await waitFor(() => expect(view.onFoldersChanged).toHaveBeenCalled());
    expect(running.start).not.toHaveBeenCalled();

    view.rerender({ ...running, running: false });

    await waitFor(() => expect(running.start).toHaveBeenCalledWith([7]));
  });

  it("says why a folder could not be added", async () => {
    mocks.addRoot.mockRejectedValue({
      code: "invalid_path",
      message: "/Users/me/work is not a directory",
    });
    const view = await renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Add folder…" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "/Users/me/work is not a directory"
    );
    expect(view.scan.start).not.toHaveBeenCalled();
  });

  it("stops indexing a folder that is switched off", async () => {
    const view = await renderSettings();

    fireEvent.click(screen.getByRole("switch", { name: "Index ~/GitHub" }));

    await waitFor(() =>
      expect(view.scan.start).toHaveBeenCalledWith(undefined)
    );
    expect(mocks.setRootEnabled).toHaveBeenCalledWith(1, false);
    expect(view.onFoldersChanged).toHaveBeenCalled();
  });

  it("removes a folder only after the user confirms", async () => {
    const view = await renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Remove ~/GitHub" }));
    const confirm = await screen.findByRole("button", {
      name: "Remove folder",
    });
    expect(mocks.removeRoot).not.toHaveBeenCalled();

    fireEvent.click(confirm);

    await waitFor(() => expect(view.onFoldersChanged).toHaveBeenCalled());
    expect(mocks.removeRoot).toHaveBeenCalledWith(1);
  });

  it("turns live re-indexing off", async () => {
    await renderSettings();
    const watch = screen.getByRole("switch", { name: "Watch for changes" });
    await waitFor(() => expect(watch).toBeChecked());

    fireEvent.click(watch);

    await waitFor(() => expect(watch).not.toBeChecked());
    expect(mocks.setWatcherEnabled).toHaveBeenCalledWith(false);
  });

  it("reports a failed update check next to the version", async () => {
    const failing = update({
      check: vi
        .fn()
        .mockResolvedValue({ status: "failed", message: "offline" }),
    });
    await renderSettings({ update: failing });
    expect(await screen.findByText("Version 1.2.3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  });

  it("asks before restarting into a new version", async () => {
    const ready = update({
      pending: new Update({
        rid: 1,
        currentVersion: "1.2.3",
        version: "1.3.0",
        rawJson: {},
      }),
    });
    await renderSettings({ update: ready });

    fireEvent.click(
      screen.getByRole("button", { name: "Install and restart" })
    );
    expect(ready.install).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Install version 1.3.0?");
  });
});
