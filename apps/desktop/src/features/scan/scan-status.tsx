import { Button } from "@ctrl-ui/react/ui/button";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { RefreshCw } from "lucide-react";

import type { ScanStats } from "@/lib/ipc-types";

import type { UseScan } from "./use-scan";

const COUNT_FORMAT = new Intl.NumberFormat();

function fileCount(count: number): string {
  return `${COUNT_FORMAT.format(count)} ${count === 1 ? "file" : "files"}`;
}

function changes({ added, changed, removed }: ScanStats): string {
  const parts: string[] = [];
  if (added > 0) {
    parts.push(`${COUNT_FORMAT.format(added)} added`);
  }
  if (changed > 0) {
    parts.push(`${COUNT_FORMAT.format(changed)} changed`);
  }
  if (removed > 0) {
    parts.push(`${COUNT_FORMAT.format(removed)} removed`);
  }
  return parts.length > 0 ? parts.join(", ") : "no changes";
}

/** What the last scan did, or what the running one has covered so far. */
export function scanSummary({
  running,
  stats,
  lastResult,
}: Pick<UseScan, "running" | "stats" | "lastResult">): string {
  if (running) {
    return stats ? `Scanning · ${fileCount(stats.seen)} checked` : "Scanning…";
  }
  if (!lastResult) {
    return "Not scanned yet";
  }
  if (lastResult.cancelled) {
    return `Scan stopped after ${fileCount(lastResult.seen)}`;
  }
  return `Last scan checked ${fileCount(lastResult.seen)} · ${changes(lastResult)}`;
}

/** The state of the index on one line, with the one action that state allows. */
export function ScanStatus({ scan }: { scan: UseScan }) {
  const failed = !scan.running && scan.error !== null;

  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        {scan.running ? <Spinner label="Scanning" /> : null}
        {failed ? (
          <Text as="p" role="alert" tone="destructive">
            {scan.error}
          </Text>
        ) : (
          <Text as="p" numeric tone="muted">
            {scanSummary(scan)}
          </Text>
        )}
      </div>
      {scan.running ? (
        <Button
          className="shrink-0"
          onClick={() => {
            scan.cancel();
          }}
          variant="surface"
        >
          Stop
        </Button>
      ) : (
        <Button
          className="shrink-0"
          onClick={() => {
            scan.start();
          }}
          variant="surface"
        >
          <RefreshCw />
          Rescan
        </Button>
      )}
    </div>
  );
}
