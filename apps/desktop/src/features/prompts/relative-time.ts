import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
  numeric: "always",
});
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Recent moments read as a distance; past a week the date itself is the
 * faster thing to recognise. */
export function formatRelativeTime(timestamp: number, now: number): string {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE_MS) {
    return "Just now";
  }
  if (elapsed < HOUR_MS) {
    return RELATIVE_FORMATTER.format(
      -Math.floor(elapsed / MINUTE_MS),
      "minute"
    );
  }
  if (elapsed < DAY_MS) {
    return RELATIVE_FORMATTER.format(-Math.floor(elapsed / HOUR_MS), "hour");
  }
  if (elapsed < WEEK_MS) {
    return RELATIVE_FORMATTER.format(-Math.floor(elapsed / DAY_MS), "day");
  }
  return DATE_FORMATTER.format(timestamp);
}

export function formatDateTime(timestamp: number): string {
  return DATE_TIME_FORMATTER.format(timestamp);
}

/** The current time, refreshed every minute so relative times do not go stale
 * while the view stays open. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
