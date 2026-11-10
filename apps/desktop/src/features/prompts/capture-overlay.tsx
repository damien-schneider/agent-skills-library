import { cn } from "@ctrl-ui/react/lib/cn";
import { Text } from "@ctrl-ui/react/ui/typography";
import { Check, CircleX, ScanText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  onCaptureError,
  onCaptureSaved,
  onCaptureShortcutProgress,
} from "@/lib/events";
import { ShiftShortcut, type ShiftShortcutProgress } from "./shift-shortcut";

const NOTICE_VISIBLE_MS = 1500;
const EXIT_ANIMATION_MS = 220;
const SHORTCUT_VISIBLE_MS = 700;
const CAPTURE_PREVIEW_LENGTH = 120;
const WHITESPACE_CHARACTER_PATTERN = /\s/u;

interface CaptureNotice {
  completedTaps: ShiftShortcutProgress;
  detail: string;
  id: number;
  tone: "error" | "saved" | "shortcut";
}

const NOTICE_LOOK = {
  error: {
    Icon: CircleX,
    iconTone: "bg-destructive/15 text-destructive-text",
    title: "Nothing saved",
  },
  saved: {
    Icon: Check,
    iconTone: "bg-success/15 text-success-text",
    title: "Saved to Prompts",
  },
  shortcut: {
    Icon: ScanText,
    iconTone: "bg-muted text-foreground",
    title: "Capture selection",
  },
} as const;

function capturePreview(content: string): string {
  const characters: string[] = [];
  let pendingSpace = false;
  for (const character of content) {
    if (WHITESPACE_CHARACTER_PATTERN.test(character)) {
      pendingSpace = characters.length > 0;
      continue;
    }
    if (pendingSpace) {
      characters.push(" ");
      pendingSpace = false;
    }
    characters.push(character);
    if (characters.length > CAPTURE_PREVIEW_LENGTH) {
      characters.length = CAPTURE_PREVIEW_LENGTH;
      return `${characters.join("").trimEnd()}…`;
    }
  }
  return characters.join("");
}

export function CaptureOverlay() {
  const [notice, setNotice] = useState<CaptureNotice | null>(null);
  const [exiting, setExiting] = useState(false);
  const sequenceRef = useRef(0);
  const activeNoticeIdRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | undefined>(undefined);
  const clearTimerRef = useRef<number | undefined>(undefined);

  const showNotice = useCallback(
    (nextNotice: Omit<CaptureNotice, "id">, visibleMs = NOTICE_VISIBLE_MS) => {
      window.clearTimeout(exitTimerRef.current);
      window.clearTimeout(clearTimerRef.current);
      setExiting(false);
      let noticeId = activeNoticeIdRef.current;
      if (noticeId === null) {
        sequenceRef.current += 1;
        noticeId = sequenceRef.current;
        activeNoticeIdRef.current = noticeId;
      }
      setNotice({ ...nextNotice, id: noticeId });
      exitTimerRef.current = window.setTimeout(
        () => setExiting(true),
        visibleMs
      );
      clearTimerRef.current = window.setTimeout(() => {
        activeNoticeIdRef.current = null;
        setNotice(null);
      }, visibleMs + EXIT_ANIMATION_MS);
    },
    []
  );

  useEffect(() => {
    const subscriptions = [
      onCaptureSaved((prompt) => {
        showNotice({
          completedTaps: 2,
          detail: capturePreview(prompt.content),
          tone: "saved",
        });
      }),
      onCaptureError(({ message }) => {
        showNotice({ completedTaps: 0, detail: message, tone: "error" });
      }),
      onCaptureShortcutProgress(({ completedTaps }) => {
        if (completedTaps === 1) {
          return;
        }
        showNotice(
          {
            completedTaps,
            detail: "Reading selected text…",
            tone: "shortcut",
          },
          SHORTCUT_VISIBLE_MS
        );
      }),
    ];

    let active = true;
    Promise.allSettled(subscriptions).then((results) => {
      const registrationFailed = results.some(
        (result) => result.status === "rejected"
      );
      if (active && registrationFailed) {
        showNotice({
          detail: "Capture feedback unavailable",
          completedTaps: 0,
          tone: "error",
        });
      }
    });

    return () => {
      active = false;
      window.clearTimeout(exitTimerRef.current);
      window.clearTimeout(clearTimerRef.current);
      for (const subscription of subscriptions) {
        subscription.then((stop) => stop()).catch(() => undefined);
      }
    };
  }, [showNotice]);

  if (!notice) {
    return null;
  }

  const { Icon, iconTone, title } = NOTICE_LOOK[notice.tone];

  return (
    <output
      aria-atomic="true"
      aria-live="polite"
      className="flex h-full items-start justify-center p-2"
    >
      {/* Opaque on purpose: this window is transparent, so a translucent
          surface would let the app behind it show through the text. */}
      <span
        className="capture-island flex h-15 w-full items-center gap-3 rounded-full border border-border bg-card px-3 text-card-foreground shadow-md"
        data-exiting={exiting}
        key={notice.id}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            iconTone
          )}
        >
          <Icon aria-hidden="true" className="size-4.5" strokeWidth={2.5} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <Text as="span" weight="medium">
            {title}
          </Text>
          <Text as="span" className="truncate" size="label" tone="muted">
            {notice.detail}
          </Text>
        </span>
        <span className="me-1 flex shrink-0 items-center">
          {notice.tone === "error" ? (
            <Text as="span" size="caption" tone="muted">
              Try again
            </Text>
          ) : (
            <ShiftShortcut completedTaps={notice.completedTaps} />
          )}
        </span>
      </span>
    </output>
  );
}
