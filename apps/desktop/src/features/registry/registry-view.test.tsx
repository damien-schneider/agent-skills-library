import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegistryPane } from "./registry-pane";
import { RegistryView } from "./registry-view";

const mocks = vi.hoisted(() => ({
  usePaginatedQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  ConvexProvider: () => null,
  useConvexConnectionState: () => ({
    isWebSocketConnected: true,
    connectionRetries: 0,
  }),
  usePaginatedQuery: mocks.usePaginatedQuery,
  useQuery: () => [],
}));
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: () => Promise.resolve("/Users/me"),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-log", () => ({ warn: vi.fn() }));
vi.mock("@/lib/convex", () => ({
  convexClient: null,
  convexSiteUrl: () => null,
}));
vi.mock("@/lib/ipc", () => ({
  installFiles: vi.fn(),
  toIpcError: (cause: unknown) => cause,
}));

const INDEX = {
  files: [],
  roots: [{ id: 1, path: "/Users/me/.claude", enabled: true, addedAt: 0 }],
  ready: true,
  error: null,
  refresh: () => Promise.resolve(),
};
const PDF_TOOLS = {
  _id: "skill-1",
  name: "PDF Tools",
  description: "Read, split and merge PDF files.",
  markdown: "# PDF Tools",
  githubOwner: "acme",
  githubRepo: "skills",
  skillSlug: "pdf-tools",
  installCount: 1234,
};
const BUILD_JARGON = /VITE_|CONVEX/i;
const SEARCH_FIELD = "Search the registry";

function renderView() {
  render(<RegistryView index={INDEX} onInstalled={vi.fn()} />);
}

describe("RegistryView", () => {
  beforeEach(() => {
    mocks.usePaginatedQuery.mockReset().mockReturnValue({
      status: "Exhausted",
      results: [PDF_TOOLS],
      loadMore: vi.fn(),
    });
  });

  it("shows where a skill comes from and how often it was installed", () => {
    renderView();

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("PDF Tools");
    expect(row).toHaveTextContent("acme/skills");
    expect(row).toHaveTextContent("1.2K installs");
  });

  it("opens the install dialog for the chosen skill", async () => {
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Install PDF Tools" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Install PDF Tools");
    expect(
      await screen.findByText("~/.claude/skills/pdf-tools/SKILL.md")
    ).toBeInTheDocument();
  });

  it("searches the registry for what was typed", async () => {
    renderView();

    fireEvent.change(screen.getByLabelText(SEARCH_FIELD), {
      target: { value: " pdf " },
    });

    await waitFor(() =>
      expect(mocks.usePaginatedQuery.mock.lastCall?.[1]?.search).toBe("pdf")
    );
  });

  it("offers the full list again when nothing matches", async () => {
    mocks.usePaginatedQuery.mockReturnValue({
      status: "Exhausted",
      results: [],
      loadMore: vi.fn(),
    });
    renderView();
    fireEvent.change(screen.getByLabelText(SEARCH_FIELD), {
      target: { value: "zzz" },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Show all skills" })
    );

    expect(screen.getByLabelText(SEARCH_FIELD)).toHaveValue("");
    await waitFor(() =>
      expect(mocks.usePaginatedQuery.mock.lastCall?.[1]?.search).toBeUndefined()
    );
  });

  it("loads the next page on demand", () => {
    const loadMore = vi.fn();
    mocks.usePaginatedQuery.mockReturnValue({
      status: "CanLoadMore",
      results: [PDF_TOOLS],
      loadMore,
    });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(loadMore).toHaveBeenCalledOnce();
  });
});

describe("RegistryPane", () => {
  it("tells users of a build without the registry so, in plain words", () => {
    render(<RegistryPane index={INDEX} onInstalled={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Registry" })
    ).toBeInTheDocument();
    expect(screen.queryByText(BUILD_JARGON)).toBeNull();
    expect(screen.queryByLabelText(SEARCH_FIELD)).toBeNull();
  });
});
