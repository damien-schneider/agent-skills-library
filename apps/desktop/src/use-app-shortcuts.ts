import { useEffect, useEffectEvent } from "react";

export interface AppShortcutHandlers {
  onOpenPalette: () => void;
  onNewSkill: () => void;
  onSave: () => void;
}

/**
 * Window-wide shortcuts. They work from inside text fields too: saving and
 * searching are exactly what someone typing reaches for.
 */
export function useAppShortcuts(handlers: AppShortcutHandlers): void {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
      return;
    }
    const actions: Record<string, (() => void) | undefined> = {
      k: handlers.onOpenPalette,
      n: handlers.onNewSkill,
      s: handlers.onSave,
    };
    const action = actions[event.key.toLowerCase()];
    if (action) {
      event.preventDefault();
      action();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
