import { Image } from "@tauri-apps/api/image";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { type PendingPromptImage, readPromptAttachment } from "@/lib/ipc";
import type { PromptAttachment } from "@/lib/ipc-types";

export const MAX_PROMPT_IMAGES = 8;

export interface DraftPromptImage extends PendingPromptImage {
  id: string;
  previewUrl: string;
}

interface ClipboardImage {
  close: () => Promise<void>;
  rgba: () => Promise<Uint8Array>;
  size: () => Promise<{ width: number; height: number }>;
}

export async function draftImageFromClipboard(
  image: ClipboardImage
): Promise<DraftPromptImage> {
  try {
    const [{ width, height }, rgba] = await Promise.all([
      image.size(),
      image.rgba(),
    ]);
    return {
      id: crypto.randomUUID(),
      previewUrl: rgbaToDataUrl(rgba, width, height),
      rgba: Array.from(rgba),
      width,
      height,
    };
  } finally {
    await image.close();
  }
}

export function rgbaToDataUrl(
  rgba: Uint8Array,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create image preview");
  }
  context.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), width, height),
    0,
    0
  );
  return canvas.toDataURL("image/png");
}

export async function attachmentPng(
  attachment: PromptAttachment
): Promise<Uint8Array> {
  return Uint8Array.from(await readPromptAttachment(attachment.id));
}

export async function attachmentDataUrl(
  attachment: PromptAttachment
): Promise<string> {
  const png = new Uint8Array(await attachmentPng(attachment));
  const blob = new Blob([png.buffer], {
    type: attachment.mimeType,
  });
  return URL.createObjectURL(blob);
}

export async function copyAttachmentImage(
  attachment: PromptAttachment
): Promise<void> {
  const image = await Image.fromBytes(await attachmentPng(attachment));
  try {
    await writeImage(image);
  } finally {
    await image.close();
  }
}

export function claudeCodePrompt(entry: {
  content: string;
  attachments: PromptAttachment[];
}): string {
  if (entry.attachments.length === 0) {
    return entry.content;
  }
  const references = entry.attachments
    .map((attachment) => `- @${attachment.path}`)
    .join("\n");
  return `${entry.content}\n\nAttached images:\n${references}`;
}
