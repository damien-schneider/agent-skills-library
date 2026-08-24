import { ArrowUp, Square, Undo2, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Streamdown } from "streamdown";

import { DiffView } from "@/shared/components/diff-view";
import { Button } from "@/shared/components/ui/button";
import { Tooltip } from "@/shared/components/ui/tooltip";

import type { AgentMessage, UseAgentSession } from "./use-agent-session";

export interface AgentPanelProps {
  session: UseAgentSession;
  documentText: string;
  onApply: (text: string) => void;
  onClose: () => void;
}

function Bubble({ message }: { message: AgentMessage }) {
  if (message.role === "you") {
    return (
      <p className="max-w-[85%] self-end rounded-2xl bg-muted px-3 py-2 text-sm">
        {message.text}
      </p>
    );
  }

  return (
    <Streamdown className="w-full text-sm leading-relaxed [&_pre]:text-xs">
      {message.text}
    </Streamdown>
  );
}

function Proposal({
  after,
  before,
  onApply,
  onDiscard,
}: {
  after: string;
  before: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mx-3 mb-2 flex min-h-0 flex-col gap-2 rounded-2xl bg-background/70 p-2 shadow-sm">
      <DiffView after={after} before={before} className="max-h-56" />
      <div className="flex items-center justify-end gap-1">
        <Tooltip label="Discard">
          <Button
            aria-label="Discard"
            onClick={onDiscard}
            size="icon-sm"
            variant="ghost"
          >
            <Undo2 />
          </Button>
        </Tooltip>
        <Button onClick={onApply} size="sm">
          Apply
        </Button>
      </div>
    </div>
  );
}

export function AgentPanel({
  session,
  documentText,
  onApply,
  onClose,
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  const proposed =
    session.proposal !== null && session.proposal !== documentText
      ? session.proposal
      : null;

  const submit = async () => {
    const asked = prompt.trim();
    if (asked.length === 0) {
      return;
    }
    setPrompt("");
    await session.send(asked, documentText);
  };

  const submitOnEnter = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await submit();
    }
  };

  return (
    <aside className="flex w-96 shrink-0 flex-col bg-muted/20">
      <div className="flex justify-end px-2 pt-2">
        <Tooltip label="Close">
          <Button
            aria-label="Close the AI panel"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X />
          </Button>
        </Tooltip>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-start gap-3 overflow-auto px-3 pb-3">
        {session.messages.map((message) => (
          <Bubble key={message.key} message={message} />
        ))}
        {session.activity ? (
          <p className="animate-pulse text-muted-foreground text-xs">
            {session.activity}…
          </p>
        ) : null}
        {session.error ? (
          <p className="text-destructive text-xs">{session.error}</p>
        ) : null}
      </div>

      {proposed === null ? null : (
        <Proposal
          after={proposed}
          before={documentText}
          onApply={() => {
            onApply(proposed);
            session.dismissProposal();
          }}
          onDiscard={session.dismissProposal}
        />
      )}

      <div className="p-3">
        <div className="flex items-end gap-1 rounded-2xl bg-background/70 py-1.5 pr-1.5 pl-3 shadow-sm">
          <textarea
            aria-label="Ask the agent to change this file"
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
            disabled={!session.available}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={submitOnEnter}
            placeholder={
              session.available
                ? "Tighten the rules, rewrite the intro…"
                : "Claude Code CLI not found"
            }
            rows={1}
            value={prompt}
          />
          {session.running ? (
            <Tooltip label="Stop">
              <Button
                aria-label="Stop the agent"
                onClick={async () => {
                  await session.cancel();
                }}
                size="icon-sm"
                variant="ghost"
              >
                <Square />
              </Button>
            </Tooltip>
          ) : (
            <Button
              aria-label="Send"
              disabled={!session.available || prompt.trim().length === 0}
              onClick={async () => {
                await submit();
              }}
              size="icon-sm"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
