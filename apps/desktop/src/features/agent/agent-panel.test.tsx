import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentPanel } from "./agent-panel";
import type { UseAgentSession } from "./use-agent-session";

const DOCUMENT = "# Rules\n\nKeep it short.";

function session(proposal: string | null): UseAgentSession {
  return {
    available: true,
    messages: [],
    activity: null,
    running: false,
    error: null,
    proposal,
    send: vi.fn(),
    cancel: vi.fn(),
    dismissProposal: vi.fn(),
  };
}

function renderPanel(proposal: string | null) {
  return render(
    <AgentPanel
      documentText={DOCUMENT}
      onApply={vi.fn()}
      onClose={vi.fn()}
      session={session(proposal)}
    />
  );
}

describe("AgentPanel", () => {
  it("offers to apply a document the agent actually changed", () => {
    renderPanel(`${DOCUMENT}\n\nAnd kind.`);

    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
  });

  it("stays quiet when the agent hands back an identical document", () => {
    renderPanel(DOCUMENT);

    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.queryByText("No changes.")).toBeNull();
  });
});
