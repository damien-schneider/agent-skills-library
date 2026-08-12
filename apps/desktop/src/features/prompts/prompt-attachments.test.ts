import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptAttachment } from "@/lib/ipc-types";

import { claudeCodePrompt, copyAttachmentImage } from "./prompt-attachments";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  fromBytes: vi.fn(),
  readPromptAttachment: vi.fn(),
  writeImage: vi.fn(),
}));

vi.mock("@tauri-apps/api/image", () => ({
  Image: { fromBytes: mocks.fromBytes },
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeImage: mocks.writeImage,
}));
vi.mock("@/lib/ipc", () => ({
  readPromptAttachment: mocks.readPromptAttachment,
}));

const attachment: PromptAttachment = {
  id: 4,
  promptId: 2,
  path: "/local/prompt-attachments/2/image-1.png",
  mimeType: "image/png",
  width: 120,
  height: 80,
};

describe("prompt attachments", () => {
  beforeEach(() => {
    mocks.close.mockReset().mockResolvedValue(undefined);
    mocks.fromBytes.mockReset().mockResolvedValue({ close: mocks.close });
    mocks.readPromptAttachment.mockReset().mockResolvedValue([1, 2, 3]);
    mocks.writeImage.mockReset().mockResolvedValue(undefined);
  });

  it("copies a saved image and releases its Tauri resource", async () => {
    await copyAttachmentImage(attachment);

    expect(mocks.fromBytes).toHaveBeenCalledWith(Uint8Array.from([1, 2, 3]));
    expect(mocks.writeImage).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("copies a Claude Code prompt with durable image references", () => {
    expect(
      claudeCodePrompt({
        content: "Review this layout",
        attachments: [attachment],
      })
    ).toBe(
      "Review this layout\n\nAttached images:\n- @/local/prompt-attachments/2/image-1.png"
    );
  });
});
