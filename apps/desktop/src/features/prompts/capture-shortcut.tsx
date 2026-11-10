import { Badge } from "@ctrl-ui/react/ui/badge";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@ctrl-ui/react/ui/item";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { ScanText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  onCaptureAccessChanged,
  onCaptureShortcutProgress,
} from "@/lib/events";
import { captureAccessStatus, requestCaptureAccess } from "@/lib/ipc";
import type { CaptureAccessStatus } from "@/lib/ipc-types";
import { ShiftShortcut, type ShiftShortcutProgress } from "./shift-shortcut";

const SHORTCUT_FEEDBACK_MS = 650;

/** The global double-Shift capture: what it does, and whether macOS lets it run. */
export function CaptureShortcut() {
  const [status, setStatus] = useState<CaptureAccessStatus | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
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

  const handleRequestAccess = async () => {
    setRequesting(true);
    setRequestFailed(false);
    try {
      setStatus(await requestCaptureAccess());
    } catch {
      setRequestFailed(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Item variant="muted">
      <ItemMedia>
        <ScanText aria-hidden="true" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Capture selection</ItemTitle>
        <ItemDescription>
          Select text in any app, then press{" "}
          <ShiftShortcut
            className="align-middle"
            completedTaps={completedTaps}
          />
          <span className="sr-only">Shift twice</span> to save it here.
        </ItemDescription>
        {requestFailed ? (
          <Text role="alert" size="label" tone="destructive">
            Could not open the Accessibility settings.
          </Text>
        ) : null}
      </ItemContent>
      <ItemActions>
        {status.granted ? (
          <Badge color="green">Ready</Badge>
        ) : (
          <>
            <Badge color="yellow">Needs Accessibility access</Badge>
            <Button
              disabled={requesting}
              onClick={handleRequestAccess}
              size="sm"
              variant="surface"
            >
              {requesting ? <Spinner aria-hidden="true" /> : null}
              Allow access
            </Button>
          </>
        )}
      </ItemActions>
    </Item>
  );
}
