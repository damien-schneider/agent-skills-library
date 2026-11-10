import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 0, 15, 12);
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

describe("formatRelativeTime", () => {
  it("treats the last minute, and a clock that runs behind, as now", () => {
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe("Just now");
    expect(formatRelativeTime(NOW + MINUTE_MS, NOW)).toBe("Just now");
  });

  it("counts whole minutes, hours and days within the week", () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE_MS - 30_000, NOW)).toBe(
      relative.format(-5, "minute")
    );
    expect(formatRelativeTime(NOW - 3 * HOUR_MS, NOW)).toBe(
      relative.format(-3, "hour")
    );
    expect(formatRelativeTime(NOW - 6 * DAY_MS, NOW)).toBe(
      relative.format(-6, "day")
    );
  });

  it("falls back to the date once a week has passed", () => {
    const formatted = formatRelativeTime(NOW - 8 * DAY_MS, NOW);

    expect(formatted).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        NOW - 8 * DAY_MS
      )
    );
  });
});
