import {
  type FrontmatterSplit,
  joinFrontmatter,
  splitFrontmatter,
} from "@skills-agent-library/skills-core/frontmatter";
import { useCallback, useEffect, useState } from "react";

import { onIndexUpdated } from "@/lib/events";
import { type IpcError, readFile, toIpcError, writeFile } from "@/lib/ipc";
import type { FileContent } from "@/lib/ipc-types";

export type EditorMode = "rich" | "raw";

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
  save: () => Promise<void>;
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
  const [dirty, setDirty] = useState(false);
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
      setDirty(false);
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
      setDirty(false);
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

  const setMode = useCallback((next: EditorMode) => {
    setModeState((current) => {
      if (current === next) {
        return current;
      }
      setBuffer((previous) => {
        if (!previous) {
          return previous;
        }
        if (next === "raw") {
          return { ...previous, raw: documentOf(previous, "rich") };
        }
        const split = splitFrontmatter(previous.raw);
        return { ...previous, split, body: split.body };
      });
      return next;
    });
  }, []);

  const setBody = useCallback((body: string) => {
    setBuffer((previous) => (previous ? { ...previous, body } : previous));
    setDirty(true);
  }, []);

  const setRaw = useCallback((raw: string) => {
    setBuffer((previous) => (previous ? { ...previous, raw } : previous));
    setDirty(true);
  }, []);

  const persist = useCallback(
    async (expectedHash: string) => {
      if (!buffer) {
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const text = documentOf(buffer, mode);
        const result = await writeFile(
          buffer.content.fileId,
          text,
          expectedHash
        );
        setBuffer((previous) =>
          previous
            ? {
                ...previous,
                content: {
                  ...previous.content,
                  content: text,
                  hash: result.hash,
                  mtimeMs: result.mtimeMs,
                },
              }
            : previous
        );
        setDirty(false);
        setConflict(false);
        setChangedOnDisk(false);
      } catch (cause) {
        const ipcError: IpcError = toIpcError(cause);
        if (ipcError.code === "conflict") {
          setConflict(true);
        } else {
          setError(ipcError.message);
        }
      } finally {
        setSaving(false);
      }
    },
    [buffer, mode]
  );

  const save = useCallback(async () => {
    if (buffer) {
      await persist(buffer.content.hash);
    }
  }, [buffer, persist]);

  // re-reads the disk hash first: overwriting is a deliberate "mine wins".
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
    documentText: buffer ? documentOf(buffer, mode) : "",
    setMode,
    setBody,
    setRaw,
    save,
    overwrite,
    reload,
    dismissConflict: () => setConflict(false),
  };
}
