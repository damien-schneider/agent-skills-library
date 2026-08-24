import {
  type FrontmatterSplit,
  joinFrontmatter,
  splitFrontmatter,
} from "@skills-agent-library/skills-core/frontmatter";
import { useCallback, useEffect, useRef, useState } from "react";

import { onIndexUpdated } from "@/lib/events";
import { type IpcError, readFile, toIpcError, writeFile } from "@/lib/ipc";
import type { FileContent } from "@/lib/ipc-types";

export type EditorMode = "rich" | "preview" | "raw";

export interface FileBuffer {
  content: FileContent;
  split: FrontmatterSplit;
  body: string;
  raw: string;
}

export interface UseFileContent {
  buffer: FileBuffer | null;
  mode: EditorMode;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  conflict: boolean;
  changedOnDisk: boolean;
  documentText: string;
  setMode: (mode: EditorMode) => void;
  setBody: (body: string) => void;
  setRaw: (raw: string) => void;
  replaceDocument: (text: string) => void;
  save: () => Promise<boolean>;
  overwrite: () => Promise<void>;
  reload: () => Promise<void>;
  dismissConflict: () => void;
}

function toBuffer(content: FileContent, text = content.content): FileBuffer {
  const split = splitFrontmatter(text);
  return { content, split, body: split.body, raw: text };
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
  const [mode, setModeState] = useState<EditorMode>("rich");
  const [loadingFileId, setLoadingFileId] = useState<number | null>(null);
  const [savingFileId, setSavingFileId] = useState<number | null>(null);
  const [error, setError] = useState<FileError | null>(null);
  const [conflictFileId, setConflictFileId] = useState<number | null>(null);
  const [changedOnDiskFileId, setChangedOnDiskFileId] = useState<number | null>(
    null
  );
  const loadRequestRef = useRef(0);

  const load = useCallback(async (id: number) => {
    loadRequestRef.current += 1;
    const requestId = loadRequestRef.current;
    setLoadingFileId(id);
    setError(null);
    try {
      const content = await readFile(id);
      if (loadRequestRef.current !== requestId) {
        return;
      }
      setBuffer(toBuffer(content));
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
  }, []);

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

  useEffect(() => {
    const unlisten = onIndexUpdated(({ fileIds }) => {
      if (fileId !== null && fileIds.includes(fileId)) {
        setChangedOnDiskFileId(fileId);
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [fileId]);

  const currentBuffer =
    fileId !== null && buffer?.content.fileId === fileId ? buffer : null;
  const currentError =
    fileId !== null && error?.fileId === fileId ? error.message : null;
  const loading =
    fileId !== null &&
    currentError === null &&
    (currentBuffer === null || loadingFileId === fileId);

  const setMode = useCallback(
    (next: EditorMode) => {
      if (mode === next) {
        return;
      }
      setBuffer((previous) => {
        if (!previous || previous.content.fileId !== fileId) {
          return previous;
        }
        if (next === "raw") {
          return { ...previous, raw: documentOf(previous, mode) };
        }
        if (mode === "raw") {
          const split = splitFrontmatter(previous.raw);
          return { ...previous, split, body: split.body };
        }
        return previous;
      });
      setModeState(next);
    },
    [fileId, mode]
  );

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

  const replaceDocument = useCallback(
    (text: string) => {
      setBuffer((previous) =>
        previous?.content.fileId === fileId
          ? toBuffer(previous.content, text)
          : previous
      );
    },
    [fileId]
  );

  const documentText = currentBuffer ? documentOf(currentBuffer, mode) : "";
  const dirty = currentBuffer
    ? documentText !== currentBuffer.content.content
    : false;

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
    dirty,
    loading,
    saving,
    error: currentError,
    conflict: fileId !== null && conflictFileId === fileId,
    changedOnDisk: fileId !== null && changedOnDiskFileId === fileId,
    documentText,
    setMode,
    setBody,
    setRaw,
    replaceDocument,
    save,
    overwrite,
    reload,
    dismissConflict,
  };
}
