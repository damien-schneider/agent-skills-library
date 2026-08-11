import {
  type FrontmatterSplit,
  joinFrontmatter,
  splitFrontmatter,
} from "@skills-agent-library/skills-core/frontmatter";
import { useCallback, useEffect, useState } from "react";

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
  save: () => Promise<boolean>;
  overwrite: () => Promise<void>;
  reload: () => Promise<void>;
  dismissConflict: () => void;
}

function toBuffer(content: FileContent): FileBuffer {
  const split = splitFrontmatter(content.content);
  return { content, split, body: split.body, raw: content.content };
}

function documentOf(buffer: FileBuffer, mode: EditorMode): string {
  return mode === "raw"
    ? buffer.raw
    : joinFrontmatter({ ...buffer.split, body: buffer.body });
}

export function useFileContent(fileId: number | null): UseFileContent {
  const [buffer, setBuffer] = useState<FileBuffer | null>(null);
  const [mode, setModeState] = useState<EditorMode>("rich");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [changedOnDisk, setChangedOnDisk] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const content = await readFile(id);
      setBuffer(toBuffer(content));
      setConflict(false);
      setChangedOnDisk(false);
    } catch (cause) {
      setBuffer(null);
      setError(toIpcError(cause).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fileId === null) {
      setBuffer(null);
      setConflict(false);
      setChangedOnDisk(false);
      return;
    }
    load(fileId);
  }, [fileId, load]);

  useEffect(() => {
    const unlisten = onIndexUpdated(({ fileIds }) => {
      if (fileId !== null && fileIds.includes(fileId)) {
        setChangedOnDisk(true);
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [fileId]);

  const setMode = useCallback(
    (next: EditorMode) => {
      if (mode === next) {
        return;
      }
      setBuffer((previous) => {
        if (!previous) {
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
    [mode]
  );

  const setBody = useCallback((body: string) => {
    setBuffer((previous) => (previous ? { ...previous, body } : previous));
  }, []);

  const setRaw = useCallback((raw: string) => {
    setBuffer((previous) => (previous ? { ...previous, raw } : previous));
  }, []);

  const documentText = buffer ? documentOf(buffer, mode) : "";
  const dirty = buffer ? documentText !== buffer.content.content : false;

  const persist = useCallback(
    async (expectedHash: string): Promise<boolean> => {
      if (!buffer) {
        return false;
      }
      setSaving(true);
      setError(null);
      try {
        const result = await writeFile(
          buffer.content.fileId,
          documentText,
          expectedHash
        );
        setBuffer((previous) =>
          previous
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
        setConflict(false);
        setChangedOnDisk(false);
        return true;
      } catch (cause) {
        const ipcError: IpcError = toIpcError(cause);
        if (ipcError.code === "conflict") {
          setConflict(true);
        } else {
          setError(ipcError.message);
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [buffer, documentText]
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!(buffer && dirty) || saving) {
      return false;
    }
    return await persist(buffer.content.hash);
  }, [buffer, dirty, persist, saving]);

  const overwrite = useCallback(async () => {
    if (!buffer) {
      return;
    }
    try {
      const fresh = await readFile(buffer.content.fileId);
      await persist(fresh.hash);
    } catch (cause) {
      setError(toIpcError(cause).message);
    }
  }, [buffer, persist]);

  const reload = useCallback(async () => {
    if (fileId !== null) {
      await load(fileId);
    }
  }, [fileId, load]);

  return {
    buffer,
    mode,
    dirty,
    loading,
    saving,
    error,
    conflict,
    changedOnDisk,
    documentText,
    setMode,
    setBody,
    setRaw,
    save,
    overwrite,
    reload,
    dismissConflict: () => setConflict(false),
  };
}
