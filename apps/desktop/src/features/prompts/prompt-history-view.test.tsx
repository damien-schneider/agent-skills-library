import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptHistoryEntry } from "@/lib/ipc-types";

import { PromptHistoryView } from "./prompt-history-view";

const mocks = vi.hoisted(() => ({
  createPrompt: vi.fn(),
  listPromptHistory: vi.fn(),
  open: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: mocks.writeText,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("@/lib/ipc", () => ({
  createPrompt: mocks.createPrompt,
  listPromptHistory: mocks.listPromptHistory,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

const DESTINATION_PATH = "/Users/me/project";

const storedPrompt: PromptHistoryEntry = {
  id: 7,
  content: "Review the authentication flow",
  destinationPath: DESTINATION_PATH,
  createdAt: 1_755_000_000_000,
};

const COPY_BUTTON_NAME = /Copy prompt saved/;

describe("PromptHistoryView", () => {
  beforeEach(() => {
    mocks.createPrompt.mockReset();
    mocks.listPromptHistory.mockReset().mockResolvedValue([]);
    mocks.open.mockReset().mockResolvedValue(null);
    mocks.writeText.mockReset().mockResolvedValue(undefined);
  });

  it("saves a prompt with an optional folder and copies it from history", async () => {
    mocks.open.mockResolvedValue(DESTINATION_PATH);
    mocks.createPrompt.mockResolvedValue(storedPrompt);
    render(<PromptHistoryView />);

    await waitFor(() => expect(mocks.listPromptHistory).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("New prompt"), {
      target: { value: storedPrompt.content },
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));

    expect(await screen.findByText(DESTINATION_PATH)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));

    await waitFor(() =>
      expect(mocks.createPrompt).toHaveBeenCalledWith(
        storedPrompt.content,
        DESTINATION_PATH
      )
    );
    expect(screen.getByText(storedPrompt.content)).toBeVisible();
    expect(screen.getByLabelText("New prompt")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: COPY_BUTTON_NAME }));

    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenCalledWith(storedPrompt.content)
    );
    expect(
      screen.getByRole("button", { name: COPY_BUTTON_NAME })
    ).toHaveTextContent("Copied");
  });

  it("loads prompts from local history", async () => {
    mocks.listPromptHistory.mockResolvedValue([storedPrompt]);
    render(<PromptHistoryView />);

    expect(await screen.findByText(storedPrompt.content)).toBeVisible();
    expect(screen.getByText(DESTINATION_PATH)).toBeVisible();
    expect(screen.getByText("1 prompt")).toBeVisible();
  });
});
