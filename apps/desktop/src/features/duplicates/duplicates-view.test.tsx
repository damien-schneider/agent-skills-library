import "@testing-library/jest-dom/vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { DuplicateGroup, FileRow, SyncGroupView } from "@/lib/ipc-types";

import { DuplicatesView } from "./duplicates-view";

const mocks = vi.hoisted(() => ({
  createSyncGroup: vi.fn(),
  homeDir: vi.fn(),
  listDuplicates: vi.fn(),
  listSyncGroups: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({ homeDir: mocks.homeDir }));
vi.mock("@/lib/events", () => ({
  onIndexUpdated: () => Promise.resolve(() => undefined),
}));
vi.mock("@/lib/ipc", () => ({
  createSyncGroup: mocks.createSyncGroup,
  listDuplicates: mocks.listDuplicates,
  listSyncGroups: mocks.listSyncGroups,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

const KEEP_IN_SYNC = /Keep in sync/;
const OPEN_IN_LIBRARY = "Open in Library";

function skill(id: number, folder: string): FileRow {
  return {
    id,
    rootId: 1,
    path: `/Users/me/${folder}/skills/caveman/SKILL.md`,
    relPath: "skills/caveman/SKILL.md",
    kind: "skill",
    name: "caveman",
    description: null,
    aliases: [],
    projectDir: null,
    size: 1,
    mtimeNs: 1,
    hash: "same",
    isSymlink: false,
    symlinkTarget: null,
    firstSeenAt: 0,
    lastSeenScanId: 1,
    deletedAt: null,
  };
}

const claudeCopy = skill(1, ".claude");
const cursorCopy = skill(2, ".cursor");
const duplicates: DuplicateGroup[] = [
  { hash: "same", files: [claudeCopy, cursorCopy] },
];

function renderView() {
  const onGroupCreated = vi.fn();
  const onOpenFile = vi.fn();
  render(
    <DuplicatesView onGroupCreated={onGroupCreated} onOpenFile={onOpenFile} />
  );
  return { onGroupCreated, onOpenFile };
}

describe("DuplicatesView", () => {
  // happy-dom has no Web Animations API, which Base UI's scroll area asks for
  // once it is mounted, and no layout, so the virtualized list would see a
  // zero-height viewport and render no cards.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 800,
    });
  });

  beforeEach(() => {
    mocks.homeDir.mockReset().mockResolvedValue("/Users/me");
    mocks.listDuplicates.mockReset().mockResolvedValue(duplicates);
    mocks.listSyncGroups.mockReset().mockResolvedValue([]);
    mocks.createSyncGroup.mockReset().mockResolvedValue(7);
  });

  it("names what is duplicated, how many times and where", async () => {
    renderView();

    const group = await screen.findByRole("group", { name: "caveman" });
    expect(within(group).getByText("Skill · 2 copies")).toBeVisible();
    expect(
      await within(group).findByText("~/.claude/skills/caveman/SKILL.md")
    ).toBeVisible();
    expect(
      within(group).getByText("~/.cursor/skills/caveman/SKILL.md")
    ).toBeVisible();
  });

  it("groups the copies under the top one and moves on to Sync", async () => {
    const { onGroupCreated } = renderView();

    fireEvent.click(await screen.findByRole("button", { name: KEEP_IN_SYNC }));

    await waitFor(() => expect(onGroupCreated).toHaveBeenCalledOnce());
    expect(mocks.createSyncGroup).toHaveBeenCalledWith({
      name: "caveman",
      canonicalFileId: claudeCopy.id,
      memberFileIds: [cursorCopy.id],
    });
  });

  it("keeps the user on the group when it could not be created", async () => {
    mocks.createSyncGroup.mockRejectedValue(new Error("database is locked"));
    const { onGroupCreated } = renderView();

    fireEvent.click(await screen.findByRole("button", { name: KEEP_IN_SYNC }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "database is locked"
    );
    expect(onGroupCreated).not.toHaveBeenCalled();
  });

  it("opens a copy in the Library to inspect it", async () => {
    const { onOpenFile } = renderView();

    fireEvent.click(
      await screen.findByRole("button", {
        name: OPEN_IN_LIBRARY,
        description: "~/.cursor/skills/caveman/SKILL.md",
      })
    );

    expect(onOpenFile).toHaveBeenCalledWith(cursorCopy);
  });

  it("does not offer to group copies a sync group already tracks", async () => {
    const tracked: SyncGroupView = {
      id: 3,
      name: "caveman",
      canonicalFileId: claudeCopy.id,
      createdAt: 0,
      canonical: claudeCopy,
      members: [
        {
          file: cursorCopy,
          strategy: "copy",
          baselineHash: null,
          status: "in-sync",
        },
      ],
    };
    mocks.listSyncGroups.mockResolvedValue([tracked]);
    renderView();

    const group = await screen.findByRole("group", { name: "caveman" });
    expect(within(group).getByText("Kept in sync")).toBeVisible();
    expect(screen.queryByRole("button", { name: KEEP_IN_SYNC })).toBeNull();
  });

  it("reads as good news when nothing is duplicated", async () => {
    mocks.listDuplicates.mockResolvedValue([]);
    renderView();

    expect(await screen.findByText("No duplicates")).toBeVisible();
  });

  it("folds long lists of copies until asked", async () => {
    const folders = [".a", ".b", ".c", ".d", ".e", ".f"];
    mocks.listDuplicates.mockResolvedValue([
      {
        hash: "same",
        files: folders.map((folder, index) => skill(index + 1, folder)),
      },
    ]);
    renderView();

    const group = await screen.findByRole("group", { name: "caveman" });
    expect(within(group).getAllByRole("listitem")).toHaveLength(4);

    fireEvent.click(within(group).getByRole("button", { name: "Show 2 more" }));

    expect(within(group).getAllByRole("listitem")).toHaveLength(6);
    expect(
      within(group).getByText("~/.f/skills/caveman/SKILL.md")
    ).toBeVisible();
  });
});
