import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiffView } from "./diff-view";

describe("DiffView", () => {
  it("says so instead of drawing an empty diff when nothing changed", () => {
    render(<DiffView after={"# Rules\n"} before={"# Rules\n"} />);

    expect(screen.getByText("No changes.")).toBeVisible();
    expect(screen.queryByRole("figure")).toBeNull();
  });

  it("shows the line that goes away and the one replacing it", () => {
    render(
      <DiffView
        after={"# Rules\n\nKeep it short and kind.\n"}
        before={"# Rules\n\nKeep it short.\n"}
      />
    );

    const diff = screen.getByRole("figure");
    expect(diff).toHaveTextContent("Deleted line 3: Keep it short.");
    expect(diff).toHaveTextContent("Added line 3: Keep it short and kind.");
    expect(screen.queryByText("No changes.")).toBeNull();
  });

  it("treats a change of trailing newline as a change", () => {
    render(<DiffView after={"# Rules\n"} before={"# Rules"} />);

    expect(screen.getByRole("figure")).toBeVisible();
  });
});
