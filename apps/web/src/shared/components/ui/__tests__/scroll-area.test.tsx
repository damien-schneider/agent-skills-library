import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScrollArea } from "../scroll-area";

describe("ScrollArea", () => {
  it("renders children correctly", () => {
    render(
      <ScrollArea style={{ height: 200, width: 200 }}>
        <div data-testid="content">Test Content</div>
      </ScrollArea>
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("has overflow-hidden on the root to enable scrolling", () => {
    render(
      <ScrollArea data-testid="scroll-root" style={{ height: 200, width: 200 }}>
        <div style={{ height: 500 }}>Tall content</div>
      </ScrollArea>
    );

    const root = screen.getByTestId("scroll-root");
    expect(root).toHaveClass("overflow-hidden");
  });

  it("has h-full and w-full on viewport for proper sizing", () => {
    render(
      <ScrollArea style={{ height: 200, width: 200 }}>
        <div>Content</div>
      </ScrollArea>
    );

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    expect(viewport).toHaveClass("h-full");
    expect(viewport).toHaveClass("w-full");
  });

  it("has overflow-auto on viewport for scrolling", () => {
    render(
      <ScrollArea style={{ height: 200, width: 200 }}>
        <div>Content</div>
      </ScrollArea>
    );

    const viewport = document.querySelector(
      '[data-slot="scroll-area-viewport"]'
    );
    expect(viewport).toHaveClass("overflow-auto");
  });

  it("renders both vertical and horizontal scrollbars", () => {
    render(
      <ScrollArea style={{ height: 200, width: 200 }}>
        <div style={{ height: 500, width: 500 }}>Large content</div>
      </ScrollArea>
    );

    const scrollbars = document.querySelectorAll(
      '[data-slot="scroll-area-scrollbar"]'
    );
    expect(scrollbars.length).toBe(2);

    const orientations = Array.from(scrollbars).map((sb) =>
      sb.getAttribute("data-orientation")
    );
    expect(orientations).toContain("vertical");
    expect(orientations).toContain("horizontal");
  });

  it("applies custom className to root", () => {
    render(
      <ScrollArea
        className="custom-class"
        data-testid="scroll-root"
        style={{ height: 200, width: 200 }}
      >
        <div>Content</div>
      </ScrollArea>
    );

    const root = screen.getByTestId("scroll-root");
    expect(root).toHaveClass("custom-class");
    expect(root).toHaveClass("relative");
    expect(root).toHaveClass("overflow-hidden");
  });

  describe("scroll behavior with constrained height", () => {
    it("viewport should have scroll capability when content overflows", () => {
      render(
        <ScrollArea
          data-testid="scroll-root"
          style={{ height: 100, width: 200 }}
        >
          <div style={{ height: 500 }}>
            Very tall content that should cause scrolling
          </div>
        </ScrollArea>
      );

      const viewport = document.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      expect(viewport).not.toBeNull();

      // The viewport should have overflow-auto class which enables scrolling
      expect(viewport).toHaveClass("overflow-auto");
    });

    it("works in flex container with min-h-0", () => {
      render(
        <div style={{ height: 200, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 50, flexShrink: 0 }}>Header</div>
          <ScrollArea className="min-h-0 flex-1" data-testid="scroll-root">
            <div style={{ height: 500 }}>
              Content that should scroll within the flex container
            </div>
          </ScrollArea>
        </div>
      );

      const root = screen.getByTestId("scroll-root");
      expect(root).toHaveClass("min-h-0");
      expect(root).toHaveClass("flex-1");
      expect(root).toHaveClass("overflow-hidden");

      const viewport = document.querySelector(
        '[data-slot="scroll-area-viewport"]'
      );
      expect(viewport).toHaveClass("overflow-auto");
    });
  });
});
