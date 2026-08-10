import { ArrowDownToLine } from "lucide-react";

import { cn } from "@/lib/utils";
import type { UseAppUpdate } from "./use-app-update";

export function UpdateButton({ pending, installing, install }: UseAppUpdate) {
  if (!pending) {
    return null;
  }

  return (
    <button
      className="mt-auto flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/60 disabled:pointer-events-none"
      disabled={installing}
      onClick={install}
      title={`Install ${pending.version} and restart`}
      type="button"
    >
      <ArrowDownToLine
        className={cn("h-4 w-4", installing && "animate-bounce")}
      />
      <span className="text-[10px] leading-none">{pending.version}</span>
    </button>
  );
}
