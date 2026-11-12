import {
  ChatComposer,
  ChatComposerShell,
  ChatComposerSubmit,
  ChatComposerTextarea,
  ChatComposerToolbar,
} from "@ctrl-ui/react/chat-composer";
import {
  ChatLayout,
  ChatLayoutActions,
  ChatLayoutHeader,
  ChatLayoutTitle,
  ChatThread,
  ChatThreadScrollButton,
} from "@ctrl-ui/react/chat-layout";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ctrl-ui/react/ui/empty";
import { Text } from "@ctrl-ui/react/ui/typography";
import { ArrowUp, SquareTerminal, X } from "lucide-react";
import { type RefObject, useRef, useState } from "react";

import { IconButton } from "@/shared/components/icon-button";

import {
  AgentProposal,
  type AppliedChange,
  AppliedNotice,
} from "./agent-proposal";
import { AgentTranscript } from "./agent-transcript";
import type { UseAgentSession } from "./use-agent-session";

export interface AgentPanelProps {
  session: UseAgentSession;
  documentText: string;
  onApply: (text: string) => void;
  onClose: () => void;
}

const EXAMPLES = [
  {
    label: "Tighten the description",
    prompt:
      "Tighten the description: one or two sentences that say what this does and when to use it.",
  },
  {
    label: "Restructure into steps",
    prompt:
      "Restructure the instructions into clear, numbered steps without changing their meaning.",
  },
  {
    label: "Add a “When to use” section",
    prompt:
      "Add a short “When to use” section listing the situations this applies to.",
  },
] as const;

const INSTALL_COMMAND = "npm install -g @anthropic-ai/claude-code";

function AgentUnavailable() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <SquareTerminal />
        </EmptyMedia>
        <EmptyTitle>Claude Code isn’t installed</EmptyTitle>
        <EmptyDescription>
          Edits here are made by the Claude Code command-line tool, which wasn’t
          found on this Mac. Install it from a terminal, then restart Another
          Dev Tool.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Text as="code" className="select-all" mono size="label">
          {INSTALL_COMMAND}
        </Text>
      </EmptyContent>
    </Empty>
  );
}

function AgentIntro({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>
          Describe the change you want. You review it as a diff before it
          touches the file.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="gap-2">
        {EXAMPLES.map((example) => (
          <Button
            key={example.label}
            onClick={() => onPick(example.prompt)}
            size="sm"
            variant="surface"
          >
            {example.label}
          </Button>
        ))}
      </EmptyContent>
    </Empty>
  );
}

function AgentComposer({
  value,
  onValueChange,
  running,
  onSend,
  onStop,
  textareaRef,
}: {
  value: string;
  onValueChange: (value: string) => void;
  running: boolean;
  onSend: (prompt: string) => Promise<void>;
  onStop: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <ChatComposer
      density="compact"
      onSubmit={({ value: asked, clear }) => {
        clear();
        return onSend(asked);
      }}
      onValueChange={onValueChange}
      state={running ? "submitting" : "idle"}
      value={value}
    >
      <ChatComposerShell>
        <ChatComposerTextarea
          aria-label="Ask for a change to this file"
          placeholder="Ask for a change…"
          ref={textareaRef}
        />
        <ChatComposerToolbar className="justify-end">
          <ChatComposerSubmit
            aria-label="Send"
            iconOnly
            onStop={onStop}
            size="sm"
            stopLabel="Stop"
          >
            <ArrowUp />
          </ChatComposerSubmit>
        </ChatComposerToolbar>
      </ChatComposerShell>
    </ChatComposer>
  );
}

function AgentConversation({
  session,
  documentText,
  onApply,
}: Omit<AgentPanelProps, "onClose">) {
  const [prompt, setPrompt] = useState("");
  const [applied, setApplied] = useState<AppliedChange | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const proposed =
    session.proposal !== null && session.proposal !== documentText
      ? session.proposal
      : null;
  const lastAsked = session.messages.findLast(
    (message) => message.role === "you"
  )?.text;
  const hasTranscript = session.messages.length > 0;
  const untouched =
    !(hasTranscript || session.running) &&
    session.error === null &&
    proposed === null;

  const ask = async (asked: string) => {
    setApplied(null);
    await session.send(asked, documentText);
  };

  const fillComposer = (example: string) => {
    setPrompt(example);
    textareaRef.current?.focus();
  };

  return (
    <ChatThread
      composer={
        <>
          <ChatThreadScrollButton />
          <div className="px-3 pb-3">
            <AgentComposer
              onSend={ask}
              onStop={async () => {
                await session.cancel();
              }}
              onValueChange={setPrompt}
              running={session.running}
              textareaRef={textareaRef}
              value={prompt}
            />
          </div>
        </>
      }
    >
      {untouched ? <AgentIntro onPick={fillComposer} /> : null}
      <AgentTranscript
        activity={session.activity}
        error={session.error}
        messages={session.messages}
        onRetry={
          lastAsked === undefined
            ? undefined
            : async () => {
                await ask(lastAsked);
              }
        }
        running={session.running}
      />
      {proposed === null ? null : (
        <AgentProposal
          after={proposed}
          before={documentText}
          onApply={() => {
            onApply(proposed);
            session.dismissProposal();
            setApplied({
              before: documentText,
              after: proposed,
              undone: false,
            });
          }}
          onDismiss={session.dismissProposal}
        />
      )}
      {applied && hasTranscript && !session.running ? (
        <AppliedNotice
          change={applied}
          documentText={documentText}
          onReapply={() => {
            onApply(applied.after);
            setApplied({ ...applied, undone: false });
          }}
          onUndo={() => {
            onApply(applied.before);
            setApplied({ ...applied, undone: true });
          }}
        />
      ) : null}
    </ChatThread>
  );
}

export function AgentPanel({
  session,
  documentText,
  onApply,
  onClose,
}: AgentPanelProps) {
  return (
    <aside
      aria-label="Ask Claude"
      className="flex w-96 shrink-0 border-border border-l"
    >
      <ChatLayout chrome="embedded">
        <ChatLayoutHeader
          className="h-(--titlebar-height) shrink-0"
          data-tauri-drag-region="deep"
        >
          {/* biome-ignore lint/a11y/useHeadingContent: the title's children become the heading's content */}
          <ChatLayoutTitle render={<h2 />}>Ask Claude</ChatLayoutTitle>
          <ChatLayoutActions>
            <IconButton label="Close" onClick={onClose}>
              <X />
            </IconButton>
          </ChatLayoutActions>
        </ChatLayoutHeader>
        {session.available ? (
          <AgentConversation
            documentText={documentText}
            onApply={onApply}
            session={session}
          />
        ) : (
          <AgentUnavailable />
        )}
      </ChatLayout>
    </aside>
  );
}
