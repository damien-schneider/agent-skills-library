import { useEffect } from "react";

export function useAppReloadShortcut(): void {
  useEffect(() => {
    const reloadApp = (event: KeyboardEvent) => {
      const reloadShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r";
      if (!reloadShortcut) {
        return;
      }

      event.preventDefault();
      window.location.reload();
    };

    window.addEventListener("keydown", reloadApp);
    return () => window.removeEventListener("keydown", reloadApp);
  }, []);
}
