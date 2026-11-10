import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_FEEDBACK_MS = 1600;

/** `copied` stays true for a moment after `markCopied`, long enough for the
 * control that copied to confirm it in place. */
export function useCopyFeedback(): [copied: boolean, markCopied: () => void] {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const markCopied = useCallback(() => {
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  }, []);

  return [copied, markCopied];
}
