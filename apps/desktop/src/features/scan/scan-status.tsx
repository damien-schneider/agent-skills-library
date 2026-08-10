import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

import type { UseScan } from "./use-scan";

export function ScanStatus({ scan }: { scan: UseScan }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {scan.running ? (
        <>
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">
            {scan.stats
              ? `${scan.stats.seen} seen · ${scan.stats.hashed} hashed`
              : "Starting…"}
          </span>
          <Button
            onClick={() => {
              scan.cancel();
            }}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          {scan.error ? (
            <span className="text-destructive">{scan.error}</span>
          ) : (
            <span className="text-muted-foreground">
              {scan.lastResult
                ? `${scan.lastResult.seen} files · +${scan.lastResult.added} ~${scan.lastResult.changed} -${scan.lastResult.removed}`
                : "Not scanned yet"}
            </span>
          )}
          <Button
            onClick={() => {
              scan.start();
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw />
            Scan
          </Button>
        </>
      )}
    </div>
  );
}
