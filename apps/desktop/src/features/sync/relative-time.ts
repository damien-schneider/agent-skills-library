const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const UNITS = [
  { unit: "year", size: 365 * DAY_MS },
  { unit: "month", size: 30 * DAY_MS },
  { unit: "day", size: DAY_MS },
  { unit: "hour", size: HOUR_MS },
  { unit: "minute", size: MINUTE_MS },
] as const;

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "2 hours ago", "yesterday"; anything under a minute is "just now". */
export function relativeTime(timestampMs: number, nowMs = Date.now()): string {
  const elapsed = timestampMs - nowMs;
  for (const { unit, size } of UNITS) {
    if (Math.abs(elapsed) >= size) {
      return formatter.format(Math.round(elapsed / size), unit);
    }
  }
  return "just now";
}
