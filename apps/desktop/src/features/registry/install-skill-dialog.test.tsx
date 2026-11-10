import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Root } from "@/lib/ipc-types";

import { InstallSkillDialog } from "./install-skill-dialog";

const mocks = vi.hoisted(() => ({
  homeDir: vi.fn(),
  installFiles: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({ homeDir: mocks.homeDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@/lib/convex", () => ({ convexSiteUrl: () => null }));
// The backend rejects with a `{ code, message }` payload, which is all the dialog reads.
vi.mock("@/lib/ipc", () => ({
  installFiles: mocks.installFiles,
  toIpcError: (cause: unknown) => cause,
}));

const HOME = "/Users/me";
const TARGET = "/Users/me/.claude/skills/pdf-tools/SKILL.md";
// Only the Claude folder is indexed, so it is the one personal skills folder on offer.
const ROOTS: Root[] = [
  { id: 1, path: "/Users/me/.claude", enabled: true, addedAt: 0 },
];
const SKILL = {
  name: "PDF Tools",
  markdown: "# PDF Tools",
  githubOwner: "acme",
  githubRepo: "skills",
  skillSlug: "pdf-tools",
};
const NOT_INDEXED = /not inside a folder the app indexes/;

async function openDialog() {
  const onInstalled = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <InstallSkillDialog
      index={{ files: [], roots: ROOTS }}
      onInstalled={onInstalled}
      onOpenChange={onOpenChange}
      open
      skill={SKILL}
    />
  );
  await screen.findByText("~/.claude/skills/pdf-tools/SKILL.md");
  return { onInstalled, onOpenChange };
}

describe("InstallSkillDialog", () => {
  beforeEach(() => {
    mocks.homeDir.mockReset().mockResolvedValue(HOME);
    mocks.installFiles.mockReset();
  });

  it("writes the skill to an absolute path in the personal skills folder and opens it", async () => {
    mocks.installFiles.mockResolvedValue({
      written: [TARGET],
      skipped: [],
      fileIds: [42],
    });

    const { onInstalled, onOpenChange } = await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(onInstalled).toHaveBeenCalledWith(42));
    expect(mocks.installFiles).toHaveBeenCalledWith(
      [{ path: TARGET, content: "# PDF Tools" }],
      false
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks before replacing a skill that is already there", async () => {
    mocks.installFiles
      .mockResolvedValueOnce({ written: [], skipped: [TARGET], fileIds: [] })
      .mockResolvedValueOnce({ written: [TARGET], skipped: [], fileIds: [42] });

    const { onInstalled, onOpenChange } = await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    const replace = await screen.findByRole("button", {
      name: "Replace existing skill",
    });
    expect(onInstalled).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(replace);

    await waitFor(() => expect(onInstalled).toHaveBeenCalledWith(42));
    expect(mocks.installFiles).toHaveBeenLastCalledWith(
      [{ path: TARGET, content: "# PDF Tools" }],
      true
    );
  });

  it("keeps the dialog open and says why when the folder is not indexed", async () => {
    mocks.installFiles.mockRejectedValue({
      code: "outside_roots",
      message: "outside every enabled root",
    });

    const { onInstalled, onOpenChange } = await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_INDEXED);
    expect(onInstalled).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
