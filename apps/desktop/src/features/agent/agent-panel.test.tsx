import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AgentPanel } from "./agent-panel";
import type { UseAgentSession } from "./use-agent-session";

const DOCUMENT = "# Rules\n\nKeep it short.";
const PROPOSAL = `${DOCUMENT}\n\nAnd kind.`;

function renderPanel(overrides: Partial<UseAgentSession> = {}) {
  const session: UseAgentSession = {
    available: true,
    messages: [],
    activity: null,
    running: false,
    error: null,
    proposal: null,
    send: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    dismissProposal: vi.fn(),
    ...overrides,
  };
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <AgentPanel
      documentText={DOCUMENT}
      onApply={onApply}
      onClose={onClose}
      session={session}
    />
  );
  return { session, onApply, onClose };
}

/** Lets a test type into the live editor below, as the user would after applying. */
let typeInEditor: (text: string) => void = () => undefined;

/** The editor's side of the loop: applying really replaces the open document. */
function LiveEditor() {
  const [document, setDocument] = useState(DOCUMENT);
  const [proposal, setProposal] = useState<string | null>(PROPOSAL);
  typeInEditor = setDocument;
  return (
    <>
      <output data-testid="editor">{document}</output>
      <AgentPanel
        documentText={document}
        onApply={setDocument}
        onClose={vi.fn()}
        session={{
          available: true,
          messages: [{ key: "you-1", role: "you", text: "be kind" }],
          activity: null,
          running: false,
          error: null,
          proposal,
          send: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn().mockResolvedValue(undefined),
          dismissProposal: () => setProposal(null),
        }}
      />
    </>
  );
}

const composer = () => screen.getByRole<HTMLTextAreaElement>("textbox");

describe("AgentPanel", () => {
  it("sends the request with the open document on Enter", () => {
    const { session } = renderPanel();

    fireEvent.change(composer(), { target: { value: "tighten it" } });
    fireEvent.keyDown(composer(), { key: "Enter" });

    expect(session.send).toHaveBeenCalledWith("tighten it", DOCUMENT);
  });

  it("keeps Shift+Enter for a new line", () => {
    const { session } = renderPanel();

    fireEvent.change(composer(), { target: { value: "tighten it" } });
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true });

    expect(session.send).not.toHaveBeenCalled();
  });

  it("drafts an example request without sending it", () => {
    const { session } = renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: "Restructure into steps" })
    );

    expect(composer().value).not.toBe("");
    expect(session.send).not.toHaveBeenCalled();
  });

  it("has no composer when the agent CLI is missing", () => {
    renderPanel({ available: false });

    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("lets a running request be stopped", () => {
    const { session } = renderPanel({
      running: true,
      messages: [{ key: "you-1", role: "you", text: "tighten it" }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(session.cancel).toHaveBeenCalled();
  });

  it("applies a document the agent actually changed to the editor", () => {
    const { session, onApply } = renderPanel({ proposal: PROPOSAL });

    fireEvent.click(screen.getByRole("button", { name: "Apply to editor" }));

    expect(onApply).toHaveBeenCalledWith(PROPOSAL);
    expect(session.dismissProposal).toHaveBeenCalled();
  });

  it("takes an applied change back out, and offers it again", () => {
    render(<LiveEditor />);
    const editor = () => screen.getByTestId("editor").textContent;

    fireEvent.click(screen.getByRole("button", { name: "Apply to editor" }));
    expect(editor()).toBe(PROPOSAL);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(editor()).toBe(DOCUMENT);
    expect(screen.getByText("Change undone")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apply again" }));
    expect(editor()).toBe(PROPOSAL);
  });

  it("never offers an undo that would erase edits made after applying", () => {
    render(<LiveEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Apply to editor" }));
    act(() => {
      typeInEditor(`${PROPOSAL} Typed by hand.`);
    });

    expect(screen.getByText("Applied to the editor")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("dismisses a proposal without touching the editor", () => {
    const { session, onApply } = renderPanel({ proposal: PROPOSAL });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(session.dismissProposal).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("stays quiet when the agent hands back an identical document", () => {
    renderPanel({ proposal: DOCUMENT });

    expect(
      screen.queryByRole("button", { name: "Apply to editor" })
    ).toBeNull();
  });

  it("shows a failure and sends the same request again on retry", () => {
    const { session } = renderPanel({
      error: "The agent exited early.",
      messages: [{ key: "you-1", role: "you", text: "tighten it" }],
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "The agent exited early."
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(session.send).toHaveBeenCalledWith("tighten it", DOCUMENT);
  });
});
