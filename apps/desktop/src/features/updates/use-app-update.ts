import { warn } from "@tauri-apps/plugin-log";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export interface UseAppUpdate {
  pending: Update | null;
  installing: boolean;
  install: () => Promise<void>;
}

export function useAppUpdate(): UseAppUpdate {
  const [pending, setPending] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const checking = useRef(false);
  const lastCheckedAt = useRef<number | null>(null);

  const checkForUpdate = useCallback(async () => {
    const now = Date.now();
    const elapsedSinceLastCheck =
      lastCheckedAt.current === null ? null : now - lastCheckedAt.current;
    const checkedRecently =
      elapsedSinceLastCheck !== null &&
      elapsedSinceLastCheck >= 0 &&
      elapsedSinceLastCheck < UPDATE_CHECK_INTERVAL_MS;

    if (checking.current || checkedRecently) {
      return;
    }

    checking.current = true;
    lastCheckedAt.current = now;
    try {
      setPending(await check());
    } catch (cause) {
      await warn(`update check failed: ${cause}`);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
    window.addEventListener("focus", checkForUpdate);
    return () => window.removeEventListener("focus", checkForUpdate);
  }, [checkForUpdate]);

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
      toast.error(`Update failed: ${cause}`);
    }
  }, [pending]);

  return { pending, installing, install };
}
