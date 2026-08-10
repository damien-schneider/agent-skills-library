import { useCallback, useEffect, useState } from "react";

import { onScanDone, onScanError, onScanProgress } from "@/lib/events";
import { cancelScan, startScan, toIpcError } from "@/lib/ipc";
import type { ScanDoneEvent, ScanStats } from "@/lib/ipc-types";

export interface UseScan {
  running: boolean;
  stats: ScanStats | null;
  lastResult: ScanDoneEvent | null;
  error: string | null;
  start: (rootIds?: number[]) => Promise<void>;
  cancel: () => Promise<void>;
}

export function useScan(): UseScan {
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [lastResult, setLastResult] = useState<ScanDoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const subscriptions = [
      onScanProgress((payload) => setStats(payload)),
      onScanDone((payload) => {
        setRunning(false);
        setStats(payload);
        setLastResult(payload);
      }),
      onScanError((payload) => {
        setRunning(false);
        setError(payload.message);
      }),
    ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.then((stop) => stop());
      }
    };
  }, []);

  const start = useCallback(async (rootIds?: number[]) => {
    setError(null);
    setStats(null);
    setRunning(true);
    try {
      await startScan(rootIds);
    } catch (cause) {
      setRunning(false);
      setError(toIpcError(cause).message);
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      await cancelScan();
    } catch (cause) {
      setError(toIpcError(cause).message);
    }
  }, []);

  return { running, stats, lastResult, error, start, cancel };
}
