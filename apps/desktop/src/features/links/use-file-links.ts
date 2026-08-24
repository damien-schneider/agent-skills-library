import { useCallback, useEffect, useState } from "react";

import { onIndexUpdated } from "@/lib/events";
import { listFileLinks } from "@/lib/ipc";
import type { FileLinks } from "@/lib/ipc-types";

const NONE: FileLinks = { outgoing: [], incoming: [] };

export function useFileLinks(fileId: number | null): FileLinks {
  const [links, setLinks] = useState<FileLinks>(NONE);

  const refresh = useCallback(async () => {
    if (fileId === null) {
      setLinks(NONE);
      return;
    }
    try {
      setLinks(await listFileLinks(fileId));
    } catch {
      setLinks(NONE);
    }
  }, [fileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = onIndexUpdated(refresh);
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [refresh]);

  return links;
}
