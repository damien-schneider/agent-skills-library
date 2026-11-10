import {
  type FrontmatterSplit,
  joinFrontmatter,
  splitFrontmatter,
} from "@skills-agent-library/skills-core/frontmatter";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { prepareRichDocument } from "@/lib/document-markdown";
import { onIndexUpdated } from "@/lib/events";
import {
  type FrontmatterKey,
  writeFrontmatterField,
} from "@/lib/frontmatter-fields";
import { type IpcError, readFile, toIpcError, writeFile } from "@/lib/ipc";
import type { FileContent } from "@/lib/ipc-types";
import type { PreservedMarkdown } from "@/lib/markdown-preserve";

/** `rich` is the visual editor; `raw` is the whole file as text, frontmatter included. */
export type EditorMode = "rich" | "raw";

export interface FileBuffer {
  body: string;
  content: FileContent;
  raw: string;
  /** The body prepared for the visual editor; null when only source editing is safe. */
  rich: PreservedMarkdown | null;
  split: FrontmatterSplit;
}

export interface UseFileContent {
  /** Gives up on the visual editor for this document and continues in source. */
  abandonRich: () => void;
  buffer: FileBuffer | null;
  changedOnDisk: boolean;
  conflict: boolean;
  dirty: boolean;
  dismissConflict: () => void;
  documentText: string;
  error: string | null;
  loading: boolean;
  mode: EditorMode;
  overwrite: () => Promise<void>;
  reload: () => Promise<void>;
  replaceDocument: (text: string) => void;
  /** Changes whenever the document is replaced other than by typing in the visual editor. */
  revision: number;
  save: () => Promise<boolean>;
  saving: boolean;
  setBody: (body: string) => void;
  /** Returns false when the frontmatter cannot be edited field by field. */
  setFrontmatterField: (key: FrontmatterKey, value: string) => boolean;
  /** Returns false when the visual editor cannot show the document as it stands. */
  setMode: (mode: EditorMode) => boolean;
  setRaw: (raw: string) => void;
}

function toBuffer(content: FileContent, text = content.content): FileBuffer {
  const split = splitFrontmatter(text);
  return {
    content,
    split,
    body: split.body,
    raw: text,
    rich: prepareRichDocument(split.body),
  };
}

function documentOf(buffer: FileBuffer, mode: EditorMode): string {
  return mode === "raw"
    ? buffer.raw
    : joinFrontmatter({ ...buffer.split, body: buffer.body });
}

interface FileError {
  fileId: number;
  message: string;
}

export function useFileContent(fileId: number | null): UseFileContent {
  const [buffer, setBuffer] = useState<FileBuffer | null>(null);
  const [revision, setRevision] = useState(0);
  const [preferredMode, setPreferredMode] = useState<EditorMode>("rich");
  const [loadingFileId, setLoadingFileId] = useState<number | null>(null);
  const [savingFileId, setSavingFileId] = useState<number | null>(null);
  const [error, setError] = useState<FileError | null>(null);
  const [conflictFileId, setConflictFileId] = useState<number | null>(null);
  const [changedOnDiskFileId, setChangedOnDiskFileId] = useState<number | null>(
    null
  );
  const loadRequestRef = useRef(0);

  const show = useCallback((next: FileBuffer) => {
    setBuffer(next);
    setRevision((current) => current + 1);
  }, []);

  const load = useCallback(
    async (id: number) => {
      loadRequestRef.current += 1;
      const requestId = loadRequestRef.current;
      setLoadingFileId(id);
      setError(null);
      try {
        const content = await readFile(id);
        if (loadRequestRef.current !== requestId) {
          return;
        }
        show(toBuffer(content));
        setConflictFileId(null);
        setChangedOnDiskFileId(null);
      } catch (cause) {
        if (loadRequestRef.current !== requestId) {
          return;
        }
        setBuffer(null);
        setError({ fileId: id, message: toIpcError(cause).message });
      } finally {
        if (loadRequestRef.current === requestId) {
          setLoadingFileId(null);
        }
      }
    },
    [show]
  );

  useEffect(() => {
    if (fileId === null) {
      loadRequestRef.current += 1;
      setBuffer(null);
      setLoadingFileId(null);
      setError(null);
      setConflictFileId(null);
      setChangedOnDiskFileId(null);
      return;
    }
    load(fileId);
  }, [fileId, load]);

  const currentBuffer =
    fileId !== null && buffer?.content.fileId === fileId ? buffer : null;
  const currentError =
    fileId !== null && error?.fileId === fileId ? error.message : null;
  const loading =
    fileId !== null &&
    currentError === null &&
    (currentBuffer === null || loadingFileId === fileId);
  const mode: EditorMode =
    preferredMode === "rich" && currentBuffer?.rich ? "rich" : "raw";
  const documentText = currentBuffer ? documentOf(currentBuffer, mode) : "";
  const dirty = currentBuffer
    ? documentText !== currentBuffer.content.content
    : false;

  // What is on screen when a disk read comes back, which may be long after it was asked for.
  const latest = useRef({ buffer: currentBuffer, dirty });
  latest.current = { buffer: currentBuffer, dirty };

  const followDisk = useEffectEvent(async (id: number) => {
    let fresh: FileContent;
    try {
      fresh = await readFile(id);
    } catch {
      setChangedOnDiskFileId(id);
      return;
    }
    const now = latest.current;
    const isSameText =
      now.buffer?.content.fileId !== id ||
      now.buffer.content.hash === fresh.hash;
    if (isSameText) {
      return;
    }
    // Nothing of the user's is at stake, so the editor simply shows the new file.
    if (now.dirty) {
      setChangedOnDiskFileId(id);
    } else {
      show(toBuffer(fresh));
    }
  });

  useEffect(() => {
    const unlisten = onIndexUpdated(({ fileIds }) => {
      if (fileId !== null && fileIds.includes(fileId)) {
        followDisk(fileId);
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [fileId]);

  const setMode = useCallback(
    (next: EditorMode): boolean => {
      if (!currentBuffer || next === mode) {
        return next === mode;
      }
      if (next === "raw") {
        setBuffer({ ...currentBuffer, raw: documentOf(currentBuffer, "rich") });
        setPreferredMode("raw");
        return true;
      }
      const split = splitFrontmatter(currentBuffer.raw);
      const rich = prepareRichDocument(split.body);
      if (!rich) {
        return false;
      }
      show({ ...currentBuffer, split, body: split.body, rich });
      setPreferredMode("rich");
      return true;
    },
    [currentBuffer, mode, show]
  );

  const abandonRich = useCallback(() => {
    setBuffer((previous) =>
      previous?.content.fileId === fileId
        ? { ...previous, raw: documentOf(previous, "rich"), rich: null }
        : previous
    );
  }, [fileId]);

  const setBody = useCallback(
    (body: string) => {
      setBuffer((previous) =>
        previous?.content.fileId === fileId ? { ...previous, body } : previous
      );
    },
    [fileId]
  );

  const setRaw = useCallback(
    (raw: string) => {
      setBuffer((previous) =>
        previous?.content.fileId === fileId ? { ...previous, raw } : previous
      );
    },
    [fileId]
  );

  const setFrontmatterField = useCallback(
    (key: FrontmatterKey, value: string): boolean => {
      if (!currentBuffer) {
        return false;
      }
      const { split } = currentBuffer;
      const frontmatter = writeFrontmatterField(
        split.frontmatter,
        key,
        value,
        split.lineEnding
      );
      if (frontmatter === null) {
        return false;
      }
      const fence = `---${split.lineEnding}`;
      setBuffer({
        ...currentBuffer,
        split:
          split.frontmatter === null
            ? { ...split, frontmatter, prefix: fence, suffix: fence }
            : { ...split, frontmatter },
      });
      return true;
    },
    [currentBuffer]
  );

  const replaceDocument = useCallback(
    (text: string) => {
      if (currentBuffer) {
        show(toBuffer(currentBuffer.content, text));
      }
    },
    [currentBuffer, show]
  );

  const persist = useCallback(
    async (expectedHash: string): Promise<boolean> => {
      if (!currentBuffer) {
        return false;
      }
      const targetFileId = currentBuffer.content.fileId;
      setSavingFileId(targetFileId);
      setError((current) =>
        current?.fileId === targetFileId ? null : current
      );
      try {
        const result = await writeFile(
          targetFileId,
          documentText,
          expectedHash
        );
        setBuffer((previous) =>
          previous?.content.fileId === targetFileId
            ? {
                ...previous,
                content: {
                  ...previous.content,
                  content: documentText,
                  hash: result.hash,
                  mtimeMs: result.mtimeMs,
                },
              }
            : previous
        );
        setConflictFileId((current) =>
          current === targetFileId ? null : current
        );
        setChangedOnDiskFileId((current) =>
          current === targetFileId ? null : current
        );
        return true;
      } catch (cause) {
        const ipcError: IpcError = toIpcError(cause);
        if (ipcError.code === "conflict") {
          setConflictFileId(targetFileId);
        } else {
          setError({ fileId: targetFileId, message: ipcError.message });
        }
        return false;
      } finally {
        setSavingFileId((current) =>
          current === targetFileId ? null : current
        );
      }
    },
    [currentBuffer, documentText]
  );

  const saving = fileId !== null && savingFileId === fileId;

  const save = useCallback(async (): Promise<boolean> => {
    if (!(currentBuffer && dirty) || saving) {
      return false;
    }
    return await persist(currentBuffer.content.hash);
  }, [currentBuffer, dirty, persist, saving]);

  const overwrite = useCallback(async () => {
    if (!currentBuffer) {
      return;
    }
    try {
      const fresh = await readFile(currentBuffer.content.fileId);
      await persist(fresh.hash);
    } catch (cause) {
      setError({
        fileId: currentBuffer.content.fileId,
        message: toIpcError(cause).message,
      });
    }
  }, [currentBuffer, persist]);

  const reload = useCallback(async () => {
    if (fileId !== null) {
      await load(fileId);
    }
  }, [fileId, load]);

  const dismissConflict = useCallback(() => {
    setConflictFileId((current) => (current === fileId ? null : current));
  }, [fileId]);

  return {
    buffer: currentBuffer,
    mode,
    revision,
    dirty,
    loading,
    saving,
    error: currentError,
    conflict: fileId !== null && conflictFileId === fileId,
    changedOnDisk: fileId !== null && changedOnDiskFileId === fileId,
    documentText,
    setMode,
    abandonRich,
    setBody,
    setRaw,
    setFrontmatterField,
    replaceDocument,
    save,
    overwrite,
    reload,
    dismissConflict,
  };
}
