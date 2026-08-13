import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptHistoryEntry } from "@/lib/ipc-types";
import type * as PromptAttachments from "./prompt-attachments";

import { PromptHistoryView } from "./prompt-history-view";

const mocks = vi.hoisted(() => ({
  captureAccessStatus: vi.fn(),
  createPrompt: vi.fn(),
  listFavoriteProjects: vi.fn(),
  listPromptHistory: vi.fn(),
  onCaptureAccessChanged: vi.fn(),
  onCaptureSaved: vi.fn(),
  open: vi.fn(),
  readImage: vi.fn(),
  readPromptAttachment: vi.fn(),
  requestCaptureAccess: vi.fn(),
  setProjectFavorite: vi.fn(),
  writeImage: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readImage: mocks.readImage,
  writeImage: mocks.writeImage,
  writeText: mocks.writeText,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("./prompt-attachments", async (importOriginal) => {
  const original = await importOriginal<typeof PromptAttachments>();
  return {
    ...original,
    draftImageFromClipboard: vi.fn().mockResolvedValue({
      id: "draft-1",
      previewUrl: "data:image/png;base64,preview",
      rgba: [255, 0, 0, 255],
      width: 1,
      height: 1,
    }),
  };
});
vi.mock("@/lib/events", () => ({
  onCaptureAccessChanged: mocks.onCaptureAccessChanged,
  onCaptureSaved: mocks.onCaptureSaved,
}));
vi.mock("@/lib/ipc", () => ({
  captureAccessStatus: mocks.captureAccessStatus,
  createPrompt: mocks.createPrompt,
  listFavoriteProjects: mocks.listFavoriteProjects,
  listPromptHistory: mocks.listPromptHistory,
  readPromptAttachment: mocks.readPromptAttachment,
  requestCaptureAccess: mocks.requestCaptureAccess,
  setProjectFavorite: mocks.setProjectFavorite,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

const DESTINATION_PATH = "/Users/me/project";

const storedPrompt: PromptHistoryEntry = {
  id: 7,
  content: "Review the authentication flow",
  destinationPath: DESTINATION_PATH,
  createdAt: 1_755_000_000_000,
  attachments: [],
};

const COPY_BUTTON_NAME = /Copy prompt saved/;

describe("PromptHistoryView", () => {
  beforeEach(() => {
    mocks.captureAccessStatus
      .mockReset()
      .mockResolvedValue({ supported: true, granted: true });
    mocks.createPrompt.mockReset();
    mocks.listFavoriteProjects.mockReset().mockResolvedValue([]);
    mocks.listPromptHistory.mockReset().mockResolvedValue([]);
    mocks.onCaptureAccessChanged.mockReset().mockResolvedValue(() => undefined);
    mocks.onCaptureSaved.mockReset().mockResolvedValue(() => undefined);
    mocks.readImage.mockReset();
    mocks.readPromptAttachment.mockReset();
    mocks.requestCaptureAccess.mockReset();
    mocks.open.mockReset().mockResolvedValue(null);
    mocks.setProjectFavorite.mockReset().mockResolvedValue(null);
    mocks.writeText.mockReset().mockResolvedValue(undefined);
    mocks.writeImage.mockReset().mockResolvedValue(undefined);
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
        DESTINATION_PATH,
        []
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

  it("selects a shared favorite project without opening the folder picker", async () => {
    mocks.listFavoriteProjects.mockResolvedValue([
      { path: DESTINATION_PATH, createdAt: 1 },
    ]);
    mocks.createPrompt.mockResolvedValue(storedPrompt);
    render(<PromptHistoryView />);

    fireEvent.change(screen.getByLabelText("New prompt"), {
      target: { value: storedPrompt.content },
    });
    fireEvent.click(await screen.findByRole("button", { name: "project" }));
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));

    await waitFor(() =>
      expect(mocks.createPrompt).toHaveBeenCalledWith(
        storedPrompt.content,
        DESTINATION_PATH,
        []
      )
    );
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("loads prompts from local history", async () => {
    mocks.listPromptHistory.mockResolvedValue([storedPrompt]);
    render(<PromptHistoryView />);

    expect(await screen.findByText(storedPrompt.content)).toBeVisible();
    expect(screen.getByText(DESTINATION_PATH)).toBeVisible();
    expect(screen.getByText("1 prompt")).toBeVisible();
  });

  it("adds a globally captured selection to the visible history", async () => {
    render(<PromptHistoryView />);
    await waitFor(() => expect(mocks.onCaptureSaved).toHaveBeenCalledOnce());

    const listener = mocks.onCaptureSaved.mock.calls[0]?.[0];
    if (typeof listener !== "function") {
      throw new Error("Capture listener was not registered");
    }
    act(() => listener(storedPrompt));

    expect(await screen.findByText(storedPrompt.content)).toBeVisible();
    expect(screen.getByText("1 prompt")).toBeVisible();
  });

  it("offers a copy action on every saved attachment", async () => {
    mocks.listPromptHistory.mockResolvedValue([
      {
        ...storedPrompt,
        attachments: [
          {
            id: 3,
            promptId: storedPrompt.id,
            path: "/local/prompt-attachments/7/image-1.png",
            mimeType: "image/png",
            width: 1,
            height: 1,
          },
          {
            id: 4,
            promptId: storedPrompt.id,
            path: "/local/prompt-attachments/7/image-2.png",
            mimeType: "image/png",
            width: 1,
            height: 1,
          },
        ],
      },
    ]);
    mocks.readPromptAttachment.mockResolvedValue([1, 2, 3]);
    render(<PromptHistoryView />);

    expect(
      await screen.findByRole("button", { name: "Copy saved attachment 1" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy saved attachment 2" })
    ).toBeVisible();
  });

  it("pastes a clipboard image and stores its RGBA payload", async () => {
    mocks.readImage.mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
      rgba: vi.fn().mockResolvedValue(Uint8Array.from([255, 0, 0, 255])),
      size: vi.fn().mockResolvedValue({ width: 1, height: 1 }),
    });
    mocks.createPrompt.mockResolvedValue({
      ...storedPrompt,
      attachments: [
        {
          id: 3,
          promptId: storedPrompt.id,
          path: "/local/prompt-attachments/7/image-1.png",
          mimeType: "image/png",
          width: 1,
          height: 1,
        },
      ],
    });
    render(<PromptHistoryView />);
    await waitFor(() => expect(mocks.listPromptHistory).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("New prompt"), {
      target: { value: storedPrompt.content },
    });
    fireEvent.click(screen.getByRole("button", { name: "Paste image" }));

    expect(await screen.findByAltText("Draft attachment 1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));

    await waitFor(() =>
      expect(mocks.createPrompt).toHaveBeenCalledWith(
        storedPrompt.content,
        null,
        [{ rgba: [255, 0, 0, 255], width: 1, height: 1 }]
      )
    );
  });
});
