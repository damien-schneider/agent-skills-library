import {
  Activity,
  ActivityIcon,
  ActivityRow,
  ActivityTitle,
} from "@ctrl-ui/react/activity";
import { ChatTurn } from "@ctrl-ui/react/chat-layout";
import {
  ChatMessage,
  ChatMessageBody,
  ChatMessageContent,
  ChatMessageRow,
} from "@ctrl-ui/react/chat-message";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ctrl-ui/react/ui/alert";
import { Button } from "@ctrl-ui/react/ui/button";
import { Markdown } from "@ctrl-ui/react/ui/markdown";

import type { AgentMessage } from "./use-agent-session";

interface Turn {
  key: string;
  from: "user" | "assistant";
  messages: AgentMessage[];
}

/** One run answers in several text blocks; they read as a single reply. */
function groupTurns(messages: AgentMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    const from = message.role === "you" ? "user" : "assistant";
    const last = turns.at(-1);
    if (from === "assistant" && last?.from === "assistant") {
      last.messages.push(message);
    } else {
      turns.push({ key: message.key, from, messages: [message] });
    }
  }
  return turns;
}

function LiveActivity({ label }: { label: string }) {
  return (
    <Activity state="running">
      <ActivityRow>
        <ActivityIcon />
        <ActivityTitle>{label}</ActivityTitle>
      </ActivityRow>
    </Activity>
  );
}

function UserTurn({ turn }: { turn: Turn }) {
  return (
    <ChatTurn from="user">
      {turn.messages.map((message) => (
        <ChatMessage
          authorLabel="You"
          density="compact"
          from="user"
          key={message.key}
        >
          <ChatMessageRow>
            <ChatMessageBody>
              <ChatMessageContent>{message.text}</ChatMessageContent>
            </ChatMessageBody>
          </ChatMessageRow>
        </ChatMessage>
      ))}
    </ChatTurn>
  );
}

function AgentTurn({
  turn,
  streaming,
  tool,
}: {
  turn: Turn;
  streaming: boolean;
  tool: string | null;
}) {
  const lastKey = turn.messages.at(-1)?.key;

  return (
    <ChatTurn from="assistant">
      {turn.messages.map((message) => {
        const growing = streaming && message.key === lastKey;
        return (
          <ChatMessage
            authorLabel="Claude"
            density="compact"
            from="assistant"
            key={message.key}
            state={growing ? "streaming" : "idle"}
          >
            <ChatMessageRow>
              <ChatMessageBody className="max-w-full flex-1">
                <ChatMessageContent>
                  <Markdown
                    content={message.text}
                    mode={growing ? "streaming" : "static"}
                  />
                </ChatMessageContent>
              </ChatMessageBody>
            </ChatMessageRow>
          </ChatMessage>
        );
      })}
      {tool === null ? null : <LiveActivity label={`Using ${tool}`} />}
    </ChatTurn>
  );
}

export interface AgentTranscriptProps {
  messages: AgentMessage[];
  running: boolean;
  activity: string | null;
  error: string | null;
  /** Absent when there is no request to send again. */
  onRetry?: () => void;
}

export function AgentTranscript({
  messages,
  running,
  activity,
  error,
  onRetry,
}: AgentTranscriptProps) {
  const turns = groupTurns(messages);
  const lastTurn = turns.at(-1);
  const replying = running && lastTurn?.from === "assistant";

  return (
    <>
      {turns.map((turn) => {
        if (turn.from === "user") {
          return <UserTurn key={turn.key} turn={turn} />;
        }
        const live = replying && turn === lastTurn;
        return (
          <AgentTurn
            key={turn.key}
            streaming={live}
            tool={live ? activity : null}
            turn={turn}
          />
        );
      })}
      {running && !replying ? (
        <ChatTurn from="assistant">
          <LiveActivity label={activity ? `Using ${activity}` : "Thinking"} />
        </ChatTurn>
      ) : null}
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertTitle>The request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          {onRetry ? (
            <AlertAction>
              <Button onClick={onRetry} size="sm" variant="surface">
                Try again
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      )}
    </>
  );
}
