import { Button } from "@/shared/components/ui/button";
import type { UseAppUpdate } from "./use-app-update";

export function UpdateBanner({ pending, installing, install }: UseAppUpdate) {
  if (!pending) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-border border-b bg-sidebar px-4 py-2">
      <span className="truncate text-sm">
        Version {pending.version} available
      </span>
      <Button disabled={installing} onClick={install} size="sm">
        {installing ? "Installing…" : "Install and restart"}
      </Button>
    </div>
  );
}
