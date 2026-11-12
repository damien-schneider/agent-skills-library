import { useCallback, useState } from "react";

import type { FileRow } from "@/lib/ipc-types";

import { type UseFileContent, useFileContent } from "./use-file-content";

const OPEN_FILE_STORAGE_KEY = "another-dev-tool.open-file";

/** The file that was open when the app last closed, so a launch picks up where work stopped. */
export function readLastOpenedFileId(): number | null {
  const stored = Number(window.localStorage.getItem(OPEN_FILE_STORAGE_KEY));
  return Number.isInteger(stored) && stored > 0 ? stored : null;
}

export interface UseLibraryFile {
  cancelPending: () => void;
  /** Closes the open file without asking: only for a file that no longer exists. */
  close: () => void;
  confirmPending: () => void;
  editor: UseFileContent;
  /** Kept so the editor survives its file leaving the index mid-edit. */
  file: FileRow | null;
  fileId: number | null;
  pending: FileRow | null;
  select: (file: FileRow) => void;
}

/** The one place a file becomes the edited one, so no caller can skip the unsaved guard. */
export function useLibraryFile(): UseLibraryFile {
  const [fileId, setFileId] = useState<number | null>(null);
  const [file, setFile] = useState<FileRow | null>(null);
  const [pending, setPending] = useState<FileRow | null>(null);
  const editor = useFileContent(fileId);

  const open = useCallback((next: FileRow) => {
    setFile(next);
    setFileId(next.id);
    window.localStorage.setItem(OPEN_FILE_STORAGE_KEY, String(next.id));
  }, []);

  const select = useCallback(
    (next: FileRow) => {
      if (next.id === fileId) {
        return;
      }
      if (editor.dirty) {
        setPending(next);
        return;
      }
      open(next);
    },
    [editor.dirty, fileId, open]
  );

  const confirmPending = useCallback(() => {
    if (pending) {
      open(pending);
      setPending(null);
    }
  }, [open, pending]);

  const close = useCallback(() => {
    setFile(null);
    setFileId(null);
    setPending(null);
    window.localStorage.removeItem(OPEN_FILE_STORAGE_KEY);
  }, []);

  return {
    editor,
    fileId,
    file,
    pending,
    select,
    confirmPending,
    cancelPending: useCallback(() => setPending(null), []),
    close,
  };
}
