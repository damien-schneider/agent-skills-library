import { useCallback, useEffect, useRef, useState } from "react";

import {
  onAgentDelta,
  onAgentDone,
  onAgentError,
  onAgentTool,
} from "@/lib/events";
import { agentCancel, agentSend, agentStatus, toIpcError } from "@/lib/ipc";

export type AgentMessage =
  | { key: string; role: "you"; text: string }
  | { key: string; role: "agent"; runId: number; block: number; text: string };

export interface UseAgentSession {
  available: boolean;
  messages: AgentMessage[];
  activity: string | null;
  running: boolean;
  error: string | null;
  proposal: string | null;
  send: (prompt: string, document: string) => Promise<void>;
  cancel: () => Promise<void>;
  dismissProposal: () => void;
}

export function useAgentSession(fileId: number | null): UseAgentSession {
  const [available, setAvailable] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activity, setActivity] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);
  const [openFileId, setOpenFileId] = useState(fileId);
  const runIdRef = useRef<number | null>(null);
  const askedRef = useRef(0);

  // Reset before paint, so no transcript from the previous file is shown.
  if (openFileId !== fileId) {
    setOpenFileId(fileId);
    runIdRef.current = null;
    setMessages([]);
    setActivity(null);
    setRunning(false);
    setError(null);
    setProposal(null);
  }

  useEffect(() => {
    agentStatus().then((status) => setAvailable(status.available));
  }, []);

  useEffect(() => {
    const owns = (runId: number) => runIdRef.current === runId;
    const settle = () => {
      runIdRef.current = null;
      setRunning(false);
      setActivity(null);
    };
    const subscriptions = Promise.all([
      onAgentDelta(({ runId, block, text }) => {
        if (!owns(runId)) {
          return;
        }
        setActivity(null);
        setMessages((current) => {
          const last = current.at(-1);
          if (last?.role === "agent" && last.block === block) {
            return [
              ...current.slice(0, -1),
              { ...last, text: last.text + text },
            ];
          }
          return [
            ...current,
            {
              key: `agent-${runId}-${block}`,
              role: "agent",
              runId,
              block,
              text,
            },
          ];
        });
      }),
      onAgentTool(({ runId, name }) => {
        if (owns(runId)) {
          setActivity(name);
        }
      }),
      onAgentDone(({ runId, proposal: next }) => {
        if (owns(runId)) {
          settle();
          setProposal(next);
        }
      }),
      onAgentError(({ runId, message }) => {
        if (owns(runId)) {
          settle();
          setError(message);
        }
      }),
    ]);

    return () => {
      subscriptions.then((stops) => {
        for (const stop of stops) {
          stop();
        }
      });
    };
  }, []);

  const send = useCallback(
    async (prompt: string, document: string) => {
      if (fileId === null || running) {
        return;
      }
      askedRef.current += 1;
      setError(null);
      setProposal(null);
      setRunning(true);
      setMessages((current) => [
        ...current,
        { key: `you-${askedRef.current}`, role: "you", text: prompt },
      ]);
      try {
        runIdRef.current = await agentSend(fileId, document, prompt);
      } catch (cause) {
        runIdRef.current = null;
        setRunning(false);
        setError(toIpcError(cause).message);
      }
    },
    [fileId, running]
  );

  const cancel = useCallback(async () => {
    await agentCancel();
  }, []);

  const dismissProposal = useCallback(() => setProposal(null), []);

  return {
    available,
    messages,
    activity,
    running,
    error,
    proposal,
    send,
    cancel,
    dismissProposal,
  };
}
