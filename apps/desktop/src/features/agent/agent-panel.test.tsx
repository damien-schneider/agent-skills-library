import { fireEvent, render, screen } from "@testing-library/react";
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
