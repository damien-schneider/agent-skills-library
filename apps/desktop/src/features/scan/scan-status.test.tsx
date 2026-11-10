import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScanStatus } from "./scan-status";
import type { UseScan } from "./use-scan";

function scan(overrides: Partial<UseScan> = {}): UseScan {
  return {
    running: false,
    stats: null,
    lastResult: null,
    error: null,
    start: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const STATS = { seen: 1280, hashed: 4, added: 3, changed: 0, removed: 1 };

describe("ScanStatus", () => {
  it("rescans every folder on demand", () => {
    const idle = scan();
    render(<ScanStatus scan={idle} />);

    fireEvent.click(screen.getByRole("button", { name: "Rescan" }));

    expect(idle.start).toHaveBeenCalledWith();
  });

  it("offers to stop a running scan instead of starting another", () => {
    const running = scan({ running: true, stats: STATS });
    render(<ScanStatus scan={running} />);

    expect(screen.queryByRole("button", { name: "Rescan" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(running.cancel).toHaveBeenCalledOnce();
  });

  it("says what the last scan found in words", () => {
    render(
      <ScanStatus
        scan={scan({
          lastResult: { ...STATS, scanId: 1, cancelled: false },
        })}
      />
    );

    expect(
      screen.getByText("Last scan checked 1,280 files · 3 added, 1 removed")
    ).toBeInTheDocument();
  });

  it("shows why a scan failed and still lets the user retry", () => {
    render(<ScanStatus scan={scan({ error: "permission denied" })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
    expect(screen.getByRole("button", { name: "Rescan" })).toBeEnabled();
  });
});
