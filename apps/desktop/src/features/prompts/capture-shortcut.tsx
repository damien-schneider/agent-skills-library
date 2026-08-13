import { Accessibility, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { onCaptureAccessChanged } from "@/lib/events";
import { captureAccessStatus, requestCaptureAccess } from "@/lib/ipc";
import type { CaptureAccessStatus } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";

export function CaptureShortcut() {
  const [status, setStatus] = useState<CaptureAccessStatus | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let active = true;
    captureAccessStatus()
      .then((nextStatus) => {
        if (active) {
          setStatus(nextStatus);
        }
      })
      .catch(() => {
        if (active) {
          setStatus(null);
        }
      });
    const unlisten = onCaptureAccessChanged(setStatus).catch(() => undefined);

    return () => {
      active = false;
      unlisten.then((stop) => stop?.()).catch(() => undefined);
    };
  }, []);

  if (!status?.supported) {
    return null;
  }

  if (status.granted) {
    return (
      <span
        className="flex items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-1.5 text-muted-foreground text-xs"
        title="Select text in any app, then press Shift twice"
      >
        <Check aria-hidden="true" className="size-3.5 text-emerald-600" />
        <span>Capture selection</span>
        <span className="flex items-center gap-1 text-foreground">
          <kbd className="flex size-5 items-center justify-center rounded bg-background font-sans text-[10px] shadow-sm">
            ⇧
          </kbd>
          <kbd className="flex size-5 items-center justify-center rounded bg-background font-sans text-[10px] shadow-sm">
            ⇧
          </kbd>
        </span>
      </span>
    );
  }

  const handleRequestAccess = async () => {
    setRequesting(true);
    try {
      setStatus(await requestCaptureAccess());
    } catch {
      toast.error("Could not open Accessibility settings");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Button
      disabled={requesting}
      onClick={handleRequestAccess}
      size="sm"
      type="button"
      variant="outline"
    >
      <Accessibility aria-hidden="true" />
      {requesting ? "Opening…" : "Enable selection capture"}
    </Button>
  );
}
