import {
  ChatComposer,
  ChatComposerShell,
  ChatComposerSubmit,
  ChatComposerTextarea,
  ChatComposerToolbar,
  ChatComposerTools,
} from "@ctrl-ui/react/chat-composer";
import {
  ChatComposerAttachment,
  ChatComposerAttachments,
} from "@ctrl-ui/react/chat-composer-attachment";
import { Kbd } from "@ctrl-ui/react/ui/kbd";
import { Text } from "@ctrl-ui/react/ui/typography";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { ImagePlus } from "lucide-react";
import { type ClipboardEvent, useRef, useState } from "react";

import { DestinationPicker } from "@/features/destinations/destination-picker";
import { createPrompt, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";
import {
  type DraftPromptImage,
  draftImageFromClipboard,
  MAX_PROMPT_IMAGES,
} from "./prompt-attachments";

const IS_MAC = navigator.platform.includes("Mac");
const SAVE_SHORTCUT_LABEL = IS_MAC ? "⌘↩" : "Ctrl+↩";
const SAVE_SHORTCUT_KEYS = IS_MAC ? "Meta+Enter" : "Control+Enter";

export function PromptComposer({
  onCreated,
}: {
  onCreated: (entry: PromptHistoryEntry) => void;
}) {
  const [content, setContent] = useState("");
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [draftImages, setDraftImages] = useState<DraftPromptImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageLimitReached = draftImages.length >= MAX_PROMPT_IMAGES;

  const handleContentChange = (next: string) => {
    setContent(next);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createPrompt(
        content,
        destinationPath,
        draftImages.map(({ rgba, width, height }) => ({ rgba, width, height }))
      );
      onCreated(created);
      setContent("");
      setDraftImages([]);
      textareaRef.current?.focus();
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setSaving(false);
    }
  };

  const addClipboardImage = async () => {
    if (imageLimitReached) {
      setError(`A prompt can have at most ${MAX_PROMPT_IMAGES} images`);
      return;
    }
    try {
      const image = await draftImageFromClipboard(await readImage());
      setDraftImages((current) => [...current, image]);
      setError(null);
    } catch {
      setError("The clipboard does not contain an image");
    }
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const containsImage = [...event.clipboardData.items].some((item) =>
      item.type.startsWith("image/")
    );
    if (containsImage) {
      event.preventDefault();
      await addClipboardImage();
    }
  };

  const removeDraftImage = (id: string) => {
    setDraftImages((current) =>
      current.filter((candidate) => candidate.id !== id)
    );
  };

  return (
    <ChatComposer
      onSubmit={handleSave}
      onValueChange={handleContentChange}
      state={saving ? "submitting" : "idle"}
      submitKey="mod-enter"
      value={content}
    >
      <ChatComposerShell>
        {draftImages.length > 0 ? (
          <ChatComposerAttachments label="Images attached to the new prompt">
            {draftImages.map((image, index) => (
              <ChatComposerAttachment
                key={image.id}
                name={`Draft attachment ${index + 1}`}
                onRemove={() => removeDraftImage(image.id)}
                previewUrl={image.previewUrl}
                removeLabel={`Remove draft attachment ${index + 1}`}
                type="image/png"
                variant="preview"
              />
            ))}
          </ChatComposerAttachments>
        ) : null}
        <ChatComposerTextarea
          aria-label="New prompt"
          onPaste={handlePaste}
          placeholder="Write or paste a prompt to reuse later…"
          ref={textareaRef}
        />
        <ChatComposerToolbar>
          <ChatComposerTools>
            <DestinationPicker
              disabled={saving}
              onChange={setDestinationPath}
              value={destinationPath}
            />
            <IconButton
              disabled={saving || imageLimitReached}
              label="Paste image from clipboard"
              onClick={addClipboardImage}
            >
              <ImagePlus />
            </IconButton>
            {draftImages.length > 0 ? (
              <Text as="span" numeric size="caption" tone="muted">
                {draftImages.length}/{MAX_PROMPT_IMAGES}
                <span className="sr-only"> images attached</span>
              </Text>
            ) : null}
          </ChatComposerTools>
          <div className="flex items-center gap-2">
            <Kbd aria-hidden="true" variant="ghost">
              {SAVE_SHORTCUT_LABEL}
            </Kbd>
            <ChatComposerSubmit
              aria-keyshortcuts={SAVE_SHORTCUT_KEYS}
              size="sm"
            >
              Save prompt
            </ChatComposerSubmit>
          </div>
        </ChatComposerToolbar>
      </ChatComposerShell>
      {error ? (
        <Text className="mt-2" role="alert" size="label" tone="destructive">
          {error}
        </Text>
      ) : null}
    </ChatComposer>
  );
}
