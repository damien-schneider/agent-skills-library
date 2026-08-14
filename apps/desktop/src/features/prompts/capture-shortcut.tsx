import { Accessibility, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  onCaptureAccessChanged,
  onCaptureShortcutProgress,
} from "@/lib/events";
import { captureAccessStatus, requestCaptureAccess } from "@/lib/ipc";
import type { CaptureAccessStatus } from "@/lib/ipc-types";
import { Button } from "@/shared/components/ui/button";
import { ShiftShortcut, type ShiftShortcutProgress } from "./shift-shortcut";

const SHORTCUT_FEEDBACK_MS = 650;

export function CaptureShortcut() {
  const [status, setStatus] = useState<CaptureAccessStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [completedTaps, setCompletedTaps] = useState<ShiftShortcutProgress>(0);
  const feedbackTimerRef = useRef<number | undefined>(undefined);

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
    const accessUnlisten = onCaptureAccessChanged(setStatus).catch(
      () => undefined
    );
    const progressUnlisten = onCaptureShortcutProgress(({ completedTaps }) => {
      setCompletedTaps(completedTaps);
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(
        () => setCompletedTaps(0),
        SHORTCUT_FEEDBACK_MS
      );
    }).catch(() => undefined);

    return () => {
      active = false;
      window.clearTimeout(feedbackTimerRef.current);
      accessUnlisten.then((stop) => stop?.()).catch(() => undefined);
      progressUnlisten.then((stop) => stop?.()).catch(() => undefined);
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
        <span className="sr-only">
          Select text in any app, then press Shift twice.
        </span>
        <ShiftShortcut completedTaps={completedTaps} />
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
