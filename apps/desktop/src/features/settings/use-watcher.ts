import { useCallback, useEffect, useState } from "react";

import { getWatcherStatus, setWatcherEnabled, toIpcError } from "@/lib/ipc";
import type { WatcherStatus } from "@/lib/ipc-types";

export interface UseWatcher {
  /** Null until the first answer from the backend. */
  status: WatcherStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

/** Whether the app re-indexes files as they change, and whether it currently can. */
export function useWatcher(): UseWatcher {
  const [status, setStatus] = useState<WatcherStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settle = useCallback(async (request: Promise<WatcherStatus>) => {
    try {
      setStatus(await request);
      setError(null);
    } catch (cause) {
      setError(toIpcError(cause).message);
    }
  }, []);

  const refresh = useCallback(() => settle(getWatcherStatus()), [settle]);

  const setEnabled = useCallback(
    (enabled: boolean) => settle(setWatcherEnabled(enabled)),
    [settle]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, error, refresh, setEnabled };
}
