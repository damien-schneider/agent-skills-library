import "@testing-library/jest-dom/vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Backup,
  FileRow,
  SyncGroupView,
  SyncPreview,
} from "@/lib/ipc-types";

import { GroupsView } from "./groups-view";

const mocks = vi.hoisted(() => ({
  addMembers: vi.fn(),
  applySync: vi.fn(),
  createSyncGroup: vi.fn(),
  deleteSyncGroup: vi.fn(),
  homeDir: vi.fn(),
  listBackups: vi.fn(),
  listFiles: vi.fn(),
  listSyncGroups: vi.fn(),
  previewSync: vi.fn(),
  removeMember: vi.fn(),
  restoreBackup: vi.fn(),
  setCanonical: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({ homeDir: mocks.homeDir }));
vi.mock("@/lib/events", () => ({
  onIndexUpdated: () => Promise.resolve(() => undefined),
}));
vi.mock("@/lib/ipc", () => ({
  addMembers: mocks.addMembers,
  applySync: mocks.applySync,
  createSyncGroup: mocks.createSyncGroup,
  deleteSyncGroup: mocks.deleteSyncGroup,
  listBackups: mocks.listBackups,
  listFiles: mocks.listFiles,
  listSyncGroups: mocks.listSyncGroups,
  previewSync: mocks.previewSync,
  removeMember: mocks.removeMember,
  restoreBackup: mocks.restoreBackup,
  setCanonical: mocks.setCanonical,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

const REVIEW = /Review & apply/;
const APPLY_ONE = /Apply to 1 file/;
const REMOVE_GROUP = /^Remove group$/;
const RESTORE_ROW = /^Restore SKILL\.md/;
const RESTORE_CONFIRM = /Restore backup/;
const CREATE_GROUP = /Create group/;
const STAYS_ON_DISK = /2 files stay on disk/;
const KEPT_IN_BACKUPS = /kept in Backups/;
const NOT_BACKED_UP = /not backed up/;

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
    hash: `h${id}`,
    isSymlink: false,
    symlinkTarget: null,
    firstSeenAt: 0,
    lastSeenScanId: 1,
    deletedAt: null,
  };
}

const source = skill(1, ".claude");
const copy = skill(2, ".cursor");

const group: SyncGroupView = {
  id: 5,
  name: "caveman",
  canonicalFileId: source.id,
  createdAt: 0,
  canonical: source,
  members: [
    { file: copy, strategy: "copy", baselineHash: null, status: "drifted" },
  ],
};

const preview: SyncPreview = {
  groupId: group.id,
  groupName: group.name,
  canonicalFileId: source.id,
  canonicalPath: source.path,
  token: "fingerprint",
  members: [
    {
      fileId: copy.id,
      path: copy.path,
      relPath: copy.relPath,
      strategy: "copy",
      status: "drifted",
      action: "copy",
      warnings: [],
      diff: {
        identical: false,
        added: 1,
        removed: 1,
        lines: [
          { op: "equal", text: "# Caveman", leftNumber: 1, rightNumber: 1 },
          {
            op: "removed",
            text: "talk long",
            leftNumber: 2,
            rightNumber: null,
          },
          { op: "added", text: "talk short", leftNumber: null, rightNumber: 2 },
        ],
      },
    },
  ],
};

const backup: Backup = {
  id: 9,
  fileId: copy.id,
  originalPath: copy.path,
  backupPath: "/backups/2/SKILL.md",
  hash: "old",
  createdAt: Date.now() - 2 * 60 * 60 * 1000,
};

function renderView() {
  const onOpenFile = vi.fn();
  render(<GroupsView onOpenFile={onOpenFile} />);
  return { onOpenFile };
}

async function openReview() {
  fireEvent.click(await screen.findByRole("button", { name: REVIEW }));
  return await screen.findByRole("dialog");
}

describe("GroupsView", () => {
  // happy-dom has no Web Animations API, which Base UI's scroll area asks for
  // once it is mounted.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });

  beforeEach(() => {
    mocks.homeDir.mockReset().mockResolvedValue("/Users/me");
    mocks.listSyncGroups.mockReset().mockResolvedValue([group]);
    mocks.previewSync.mockReset().mockResolvedValue(preview);
    mocks.applySync.mockReset().mockResolvedValue({
      updatedFileIds: [copy.id],
      backupIds: [9],
      skipped: 0,
    });
    mocks.deleteSyncGroup.mockReset().mockResolvedValue(null);
    mocks.setCanonical.mockReset().mockResolvedValue(null);
    mocks.addMembers.mockReset().mockResolvedValue(null);
    mocks.removeMember.mockReset().mockResolvedValue(null);
    mocks.listBackups.mockReset().mockResolvedValue([backup]);
    mocks.restoreBackup.mockReset().mockResolvedValue(copy.id);
    mocks.listFiles.mockReset().mockResolvedValue([source, copy]);
    mocks.createSyncGroup.mockReset().mockResolvedValue(6);
  });

  it("shows which file is the source and which one has drifted", async () => {
    renderView();

    const card = await screen.findByRole("group", { name: "caveman" });
    const [sourceRow, copyRow] = within(card).getAllByRole("listitem");
    expect(sourceRow).toHaveTextContent("~/.claude/skills/caveman/SKILL.md");
    expect(sourceRow).toHaveTextContent("Source");
    expect(copyRow).toHaveTextContent("~/.cursor/skills/caveman/SKILL.md");
    expect(copyRow).toHaveTextContent("Out of sync");
    expect(within(card).getByText("1 out of sync")).toBeVisible();
  });

  it("previews the overwrite and applies it only on confirmation", async () => {
    renderView();
    const dialog = await openReview();

    expect(await within(dialog).findByText("Overwrite")).toBeVisible();
    expect(dialog).toHaveTextContent("Deleted line 2: talk long");
    expect(dialog).toHaveTextContent("Added line 2: talk short");
    expect(within(dialog).getByText(KEPT_IN_BACKUPS)).toBeVisible();
    expect(mocks.applySync).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: APPLY_ONE }));

    await waitFor(() =>
      expect(mocks.applySync).toHaveBeenCalledWith(group.id, "fingerprint")
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("writes nothing and offers a fresh preview when a file changed meanwhile", async () => {
    mocks.applySync.mockRejectedValue(
      Object.assign(new Error("caveman"), { code: "conflict" })
    );
    renderView();
    const dialog = await openReview();

    fireEvent.click(
      await within(dialog).findByRole("button", { name: APPLY_ONE })
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Nothing was written"
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Refresh preview" })
    );
    await waitFor(() => expect(mocks.previewSync).toHaveBeenCalledTimes(2));
  });

  it("removes a group only after saying its files stay on disk", async () => {
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: REMOVE_GROUP }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(STAYS_ON_DISK)).toBeVisible();
    expect(mocks.deleteSyncGroup).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", { name: REMOVE_GROUP })
    );

    await waitFor(() =>
      expect(mocks.deleteSyncGroup).toHaveBeenCalledWith(group.id)
    );
  });

  it("keeps the former source in the group when another file takes over", async () => {
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Make source" }));

    await waitFor(() =>
      expect(mocks.addMembers).toHaveBeenCalledWith(
        group.id,
        [source.id],
        "copy"
      )
    );
    expect(mocks.setCanonical).toHaveBeenCalledWith(group.id, copy.id);
  });

  it("opens a listed file in the Library", async () => {
    const { onOpenFile } = renderView();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open in Library",
        description: "~/.cursor/skills/caveman/SKILL.md",
      })
    );

    expect(onOpenFile).toHaveBeenCalledWith(copy);
  });

  it("restores a backup only after warning that the current content is lost", async () => {
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Backups" }));
    fireEvent.click(await screen.findByRole("button", { name: RESTORE_ROW }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(NOT_BACKED_UP)).toBeVisible();
    expect(mocks.restoreBackup).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", { name: RESTORE_CONFIRM })
    );

    await waitFor(() =>
      expect(mocks.restoreBackup).toHaveBeenCalledWith(backup.id)
    );
  });

  it("creates a group from the picked files, the first one as its source", async () => {
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "New group" }));
    const dialog = await screen.findByRole("dialog");
    const create = within(dialog).getByRole("button", { name: CREATE_GROUP });
    expect(create).toBeDisabled();

    // Picked by clicking the rows: happy-dom does not toggle Base UI's checkbox
    // from a click on the box itself, only through its label.
    fireEvent.click(
      await within(dialog).findByText("~/.claude/skills/caveman/SKILL.md")
    );
    fireEvent.click(
      within(dialog).getByText("~/.cursor/skills/caveman/SKILL.md")
    );
    expect(within(dialog).getByText("2 files selected")).toBeVisible();
    fireEvent.click(create);

    await waitFor(() =>
      expect(mocks.createSyncGroup).toHaveBeenCalledWith({
        name: "caveman",
        canonicalFileId: source.id,
        memberFileIds: [copy.id],
        strategy: "copy",
      })
    );
  });
});
