import { Check, CircleX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { onCaptureError, onCaptureSaved } from "@/lib/events";

const EXIT_DELAY_MS = 1500;
const CLEAR_DELAY_MS = 1720;
const CAPTURE_PREVIEW_LENGTH = 120;
const WHITESPACE_CHARACTER_PATTERN = /\s/u;

type CaptureNotice =
  | {
      detail: string;
      id: number;
      tone: "saved";
    }
  | {
      detail: string;
      id: number;
      tone: "error";
    };

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
  const exitTimerRef = useRef<number | undefined>(undefined);
  const clearTimerRef = useRef<number | undefined>(undefined);

  const showNotice = useCallback((nextNotice: Omit<CaptureNotice, "id">) => {
    sequenceRef.current += 1;
    window.clearTimeout(exitTimerRef.current);
    window.clearTimeout(clearTimerRef.current);
    setExiting(false);
    setNotice({ ...nextNotice, id: sequenceRef.current });
    exitTimerRef.current = window.setTimeout(
      () => setExiting(true),
      EXIT_DELAY_MS
    );
    clearTimerRef.current = window.setTimeout(
      () => setNotice(null),
      CLEAR_DELAY_MS
    );
  }, []);

  useEffect(() => {
    const subscriptions = [
      onCaptureSaved((prompt) => {
        showNotice({
          detail: capturePreview(prompt.content),
          tone: "saved",
        });
      }),
      onCaptureError(({ message }) => {
        showNotice({ detail: message, tone: "error" });
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

  const saved = notice.tone === "saved";
  const Icon = saved ? Check : CircleX;

  return (
    <output
      aria-atomic="true"
      className="flex h-full items-start justify-center p-2"
    >
      <span
        className="capture-island flex h-[60px] w-full items-center gap-3 rounded-full border border-white/10 bg-neutral-950/90 px-3 text-white shadow-[0_12px_32px_rgb(0_0_0/0.3)] backdrop-blur-xl"
        data-exiting={exiting}
        key={notice.id}
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            saved
              ? "bg-emerald-400 text-emerald-950"
              : "bg-red-400 text-red-950"
          }`}
        >
          <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-[13px] leading-5">
            {saved ? "Saved to Prompts" : "Nothing saved"}
          </span>
          <span className="block truncate text-[12px] text-neutral-300 leading-5">
            {notice.detail}
          </span>
        </span>
        <span className="mr-1 flex shrink-0 items-center gap-1 text-neutral-400">
          {saved ? (
            <>
              <kbd className="flex size-[22px] items-center justify-center rounded-md bg-white/10 font-sans text-[10px] text-white">
                ⇧
              </kbd>
              <kbd className="flex size-[22px] items-center justify-center rounded-md bg-white/10 font-sans text-[10px] text-white">
                ⇧
              </kbd>
            </>
          ) : (
            <span className="text-[11px]">Try again</span>
          )}
        </span>
      </span>
    </output>
  );
}
