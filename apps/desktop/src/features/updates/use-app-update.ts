import { warn } from "@tauri-apps/plugin-log";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseAppUpdate {
  pending: Update | null;
  installing: boolean;
  install: () => Promise<void>;
}

export function useAppUpdate(): UseAppUpdate {
  const [pending, setPending] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    check().then(setPending, (cause) => warn(`update check failed: ${cause}`));
  }, []);

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
