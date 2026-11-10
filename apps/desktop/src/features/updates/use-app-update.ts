import { toast } from "@ctrl-ui/react/ui/toast";
import { warn } from "@tauri-apps/plugin-log";
import { relaunch } from "@tauri-apps/plugin-process";
import { check as fetchUpdate, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export type UpdateCheckResult =
  | { status: "up-to-date" }
  | { status: "available"; version: string }
  | { status: "failed"; message: string };

export interface UseAppUpdate {
  pending: Update | null;
  installing: boolean;
  /** True while any check, automatic or asked for, is in flight. */
  checking: boolean;
  /** When a check last got an answer, in epoch milliseconds; null until one has. */
  lastCheckedAt: number | null;
  /** Checks now, whatever the automatic schedule says, and reports what it found. */
  check: () => Promise<UpdateCheckResult>;
  install: () => Promise<void>;
}

export function useAppUpdate(): UseAppUpdate {
  const [pending, setPending] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const inFlight = useRef<Promise<UpdateCheckResult> | null>(null);
  const lastAttemptAt = useRef<number | null>(null);

  // A check asked for while one is running joins it instead of racing it.
  const check = useCallback((): Promise<UpdateCheckResult> => {
    if (inFlight.current) {
      return inFlight.current;
    }

    const run = async (): Promise<UpdateCheckResult> => {
      try {
        const update = await fetchUpdate();
        setPending(update);
        setLastCheckedAt(Date.now());
        return update
          ? { status: "available", version: update.version }
          : { status: "up-to-date" };
      } catch (cause) {
        await warn(`update check failed: ${cause}`);
        return {
          status: "failed",
          message: cause instanceof Error ? cause.message : String(cause),
        };
      } finally {
        inFlight.current = null;
        setChecking(false);
      }
    };

    lastAttemptAt.current = Date.now();
    setChecking(true);
    inFlight.current = run();
    return inFlight.current;
  }, []);

  const checkWhenDue = useCallback(() => {
    const elapsed =
      lastAttemptAt.current === null
        ? null
        : Date.now() - lastAttemptAt.current;
    const checkedRecently =
      elapsed !== null && elapsed >= 0 && elapsed < UPDATE_CHECK_INTERVAL_MS;
    if (!checkedRecently) {
      check();
    }
  }, [check]);

  useEffect(() => {
    checkWhenDue();
    window.addEventListener("focus", checkWhenDue);
    return () => window.removeEventListener("focus", checkWhenDue);
  }, [checkWhenDue]);

  const install = useCallback(async () => {
    if (!pending) {
      return;
    }
    setInstalling(true);
    try {
      await pending.downloadAndInstall();
      await relaunch();
    } catch (cause) {
      setInstalling(false);
      toast.error("Update failed", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }, [pending]);

  return { pending, installing, checking, lastCheckedAt, check, install };
}
