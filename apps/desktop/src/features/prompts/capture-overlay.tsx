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

  const shortcut = notice.tone === "shortcut";
  const saved = notice.tone === "saved";
  let Icon = CircleX;
  let iconTone = "bg-red-400 text-red-950";
  let title = "Nothing saved";
  if (shortcut) {
    Icon = ScanText;
    iconTone = "bg-white/10 text-white";
    title = "Capture selection";
  } else if (saved) {
    Icon = Check;
    iconTone = "bg-emerald-400 text-emerald-950";
    title = "Saved to Prompts";
  }

  return (
    <output
      aria-atomic="true"
      aria-live="polite"
      className="flex h-full items-start justify-center p-2"
    >
      <span
        className="capture-island flex h-[60px] w-full items-center gap-3 rounded-full bg-neutral-950/90 px-3 text-white shadow-[0_12px_32px_rgb(0_0_0/0.3)] ring-1 ring-white/10 backdrop-blur-xl"
        data-exiting={exiting}
        key={notice.id}
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconTone}`}
        >
          <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-[13px] leading-5">
            {title}
          </span>
          <span className="block truncate text-[12px] text-neutral-300 leading-5">
            {notice.detail}
          </span>
        </span>
        <span className="mr-1 shrink-0 text-neutral-400">
          {notice.tone === "error" ? (
            <span className="text-[11px]">Try again</span>
          ) : (
            <ShiftShortcut
              completedTaps={notice.completedTaps}
              contrast="overlay"
            />
          )}
        </span>
      </span>
    </output>
  );
}
