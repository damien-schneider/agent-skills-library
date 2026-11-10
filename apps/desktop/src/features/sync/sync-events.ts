import { useEffect } from "react";

const listeners = new Set<() => void>();

/**
 * Creating or editing a sync group touches no file, so the index never reports
 * it. Views stay mounted side by side: the one that changed a group says so.
 */
export function notifySyncGroupsChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function useSyncGroupsChanged(listener: () => void): void {
  useEffect(() => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listener]);
}
