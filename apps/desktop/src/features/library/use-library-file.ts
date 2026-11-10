import { useCallback, useState } from "react";

import type { FileRow } from "@/lib/ipc-types";

import { type UseFileContent, useFileContent } from "./use-file-content";

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
