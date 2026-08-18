import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DestinationFolder } from "@/lib/ipc-types";
import { DestinationPicker } from "./destination-picker";

const mocks = vi.hoisted(() => ({
  homeDir: vi.fn(),
  listDestinationFolders: vi.fn(),
  openFolderDialog: vi.fn(),
  resolveDestinationFolder: vi.fn(),
  setProjectFavorite: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({ homeDir: mocks.homeDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.openFolderDialog }));
vi.mock("@/lib/ipc", () => ({
  listDestinationFolders: mocks.listDestinationFolders,
  resolveDestinationFolder: mocks.resolveDestinationFolder,
  setProjectFavorite: mocks.setProjectFavorite,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

const HOME = "/Users/me";
const APP_ROW = /app/;
const GONE_ROW = /gone/;
const USE_PATH_ROW = /^Use/;

function folder(
  path: string,
  overrides: Partial<DestinationFolder> = {}
): DestinationFolder {
  return {
    path,
    favorite: false,
    lastUsedAt: null,
    fileCount: 0,
    available: true,
    ...overrides,
  };
}

async function openPicker(value: string | null = null) {
  const onChange = vi.fn();
  render(<DestinationPicker onChange={onChange} value={value} />);
  fireEvent.click(screen.getByRole("combobox"));
  await screen.findByPlaceholderText("Search folders, or paste a path");
  return onChange;
}

describe("DestinationPicker", () => {
  beforeEach(() => {
    mocks.homeDir.mockReset().mockResolvedValue(HOME);
    mocks.listDestinationFolders.mockReset().mockResolvedValue([]);
    mocks.openFolderDialog.mockReset().mockResolvedValue(null);
    mocks.resolveDestinationFolder.mockReset();
    mocks.setProjectFavorite.mockReset().mockResolvedValue(null);
  });

  it("picks an indexed project without leaving the app", async () => {
    mocks.listDestinationFolders.mockResolvedValue([
      folder("/Users/me/GitHub/app", { fileCount: 3 }),
    ]);

    const onChange = await openPicker();
    fireEvent.change(
      screen.getByPlaceholderText("Search folders, or paste a path"),
      { target: { value: "app" } }
    );
    fireEvent.click(await screen.findByRole("option", { name: APP_ROW }));

    expect(onChange).toHaveBeenCalledWith("/Users/me/GitHub/app");
    expect(mocks.openFolderDialog).not.toHaveBeenCalled();
  });

  it("stars a folder straight from the list", async () => {
    mocks.listDestinationFolders.mockResolvedValue([
      folder("/Users/me/GitHub/app", { fileCount: 1 }),
    ]);

    const onChange = await openPicker();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add app to favorites" })
    );

    await waitFor(() =>
      expect(mocks.setProjectFavorite).toHaveBeenCalledWith(
        "/Users/me/GitHub/app",
        true
      )
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Remove app from favorites" })
    ).toBeVisible();
  });

  it("refuses to select a starred folder that no longer exists, but lets it go", async () => {
    mocks.listDestinationFolders.mockResolvedValue([
      folder("/Users/me/GitHub/gone", { favorite: true, available: false }),
    ]);

    const onChange = await openPicker();
    fireEvent.click(await screen.findByRole("option", { name: GONE_ROW }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Remove gone from favorites" })
    );

    await waitFor(() =>
      expect(mocks.setProjectFavorite).toHaveBeenCalledWith(
        "/Users/me/GitHub/gone",
        false
      )
    );
  });

  it("offers a pasted path once it is checked, and says so when it leads nowhere", async () => {
    mocks.resolveDestinationFolder.mockImplementation((path: string) =>
      path === "~/Documents/notes"
        ? Promise.resolve(folder("/Users/me/Documents/notes"))
        : Promise.reject(new Error("no such directory"))
    );

    const onChange = await openPicker();
    const search = screen.getByPlaceholderText(
      "Search folders, or paste a path"
    );

    fireEvent.change(search, { target: { value: "/nope" } });
    expect(await screen.findByText("No folder at /nope")).toBeVisible();
    expect(
      screen.queryByRole("option", { name: USE_PATH_ROW })
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "~/Documents/notes" } });
    fireEvent.click(
      await screen.findByRole("option", { name: "Use ~/Documents/notes" })
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("/Users/me/Documents/notes")
    );
  });

  it("falls back to the system dialog and clears the destination", async () => {
    mocks.openFolderDialog.mockResolvedValue("/Users/me/Desktop");
    mocks.resolveDestinationFolder.mockResolvedValue(
      folder("/Users/me/Desktop")
    );

    const onChange = await openPicker("/Users/me/GitHub/app");
    fireEvent.click(screen.getByRole("option", { name: "No destination" }));
    expect(onChange).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("button", { name: "Browse…" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("/Users/me/Desktop")
    );
  });
});
