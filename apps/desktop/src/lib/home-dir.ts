import { homeDir } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";

const TRAILING_SLASH_PATTERN = /\/$/;

let pending: Promise<string | null> | undefined;

function homeDirectory(): Promise<string | null> {
  pending ??= homeDir()
    .then((home) => home.replace(TRAILING_SLASH_PATTERN, ""))
    .catch(() => null);
  return pending;
}

/** `null` until resolved, and for good when the platform has no home: paths are
 * then shown in full rather than shortened to `~`. */
export function useHomeDirectory(): string | null {
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    homeDirectory().then((resolved) => {
      if (active) {
        setHome(resolved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return home;
}
