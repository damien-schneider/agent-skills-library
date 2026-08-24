import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentDeltaEvent, AgentDoneEvent } from "@/lib/ipc-types";

import { useAgentSession } from "./use-agent-session";

const mocks = vi.hoisted(() => ({
  agentSend: vi.fn(),
  agentCancel: vi.fn(),
  agentStatus: vi.fn(),
  handlers: {
    delta: [] as ((payload: AgentDeltaEvent) => void)[],
    done: [] as ((payload: AgentDoneEvent) => void)[],
  },
}));

vi.mock("@/lib/events", () => ({
  onAgentDelta: (handler: (payload: AgentDeltaEvent) => void) => {
    mocks.handlers.delta.push(handler);
    return Promise.resolve(() => undefined);
  },
  onAgentTool: () => Promise.resolve(() => undefined),
  onAgentDone: (handler: (payload: AgentDoneEvent) => void) => {
    mocks.handlers.done.push(handler);
    return Promise.resolve(() => undefined);
  },
  onAgentError: () => Promise.resolve(() => undefined),
}));

vi.mock("@/lib/ipc", () => ({
  agentSend: mocks.agentSend,
  agentCancel: mocks.agentCancel,
  agentStatus: mocks.agentStatus,
  toIpcError: (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause)),
}));

const emitDelta = (payload: AgentDeltaEvent) => {
  for (const handler of mocks.handlers.delta) {
    handler(payload);
  }
};

const emitDone = (payload: AgentDoneEvent) => {
  for (const handler of mocks.handlers.done) {
    handler(payload);
  }
};

beforeEach(() => {
  mocks.handlers.delta = [];
  mocks.handlers.done = [];
  mocks.agentSend.mockReset().mockResolvedValue(7);
  mocks.agentCancel.mockReset().mockResolvedValue(null);
  mocks.agentStatus
    .mockReset()
    .mockResolvedValue({ available: true, path: "/bin/claude", version: "1" });
});

async function sendOnce() {
  const view = renderHook(({ fileId }) => useAgentSession(fileId), {
    initialProps: { fileId: 1 as number | null },
  });
  await act(async () => {
    await view.result.current.send("tighten it", "# Before");
  });
  return view;
}

describe("useAgentSession", () => {
  it("grows one message while a block streams, and opens a new one after it", async () => {
    const { result } = await sendOnce();

    act(() => {
      emitDelta({ runId: 7, block: 1, text: "Tight" });
      emitDelta({ runId: 7, block: 1, text: "ened." });
      emitDelta({ runId: 7, block: 2, text: "Done." });
    });

    await waitFor(() => {
      expect(result.current.messages.map((message) => message.text)).toEqual([
        "tighten it",
        "Tightened.",
        "Done.",
      ]);
    });
  });

  it("surfaces the edited document once the run reports back", async () => {
    const { result } = await sendOnce();

    act(() => emitDone({ runId: 7, proposal: "# After", cancelled: false }));

    await waitFor(() => {
      expect(result.current.proposal).toBe("# After");
      expect(result.current.running).toBe(false);
    });
  });

  it("ignores a run it does not own, so a stale reply cannot land", async () => {
    const { result } = await sendOnce();

    act(() => {
      emitDelta({ runId: 99, block: 1, text: "ghost" });
      emitDone({ runId: 99, proposal: "# Wrong", cancelled: false });
    });

    expect(result.current.proposal).toBeNull();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.running).toBe(true);
  });

  it("drops the transcript when another file is opened", async () => {
    const view = await sendOnce();
    act(() => emitDone({ runId: 7, proposal: "# After", cancelled: false }));
    await waitFor(() => expect(view.result.current.proposal).toBe("# After"));

    view.rerender({ fileId: 2 });

    expect(view.result.current.messages).toEqual([]);
    expect(view.result.current.proposal).toBeNull();
  });
});
