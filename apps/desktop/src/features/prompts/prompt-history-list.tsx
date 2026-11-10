import { Button } from "@ctrl-ui/react/ui/button";
import { Input } from "@ctrl-ui/react/ui/input";
import { InputGroup, InputGroupAddon } from "@ctrl-ui/react/ui/input-group";
import { Heading, Text } from "@ctrl-ui/react/ui/typography";
import { History, Search, SearchX, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useHomeDirectory } from "@/lib/home-dir";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/shared/components/view-layout";
import { PromptHistoryItem } from "./prompt-history-item";
import { useMinuteClock } from "./relative-time";

export type PromptHistoryStatus =
  | { type: "loading" }
  | { type: "ready" }
  | { type: "error"; message: string };

function countLabel(visible: number, total: number, searching: boolean) {
  const noun = total === 1 ? "prompt" : "prompts";
  return searching ? `${visible} of ${total} ${noun}` : `${total} ${noun}`;
}

export function PromptHistoryList({
  entries,
  onRequestDelete,
  onRetry,
  status,
}: {
  entries: PromptHistoryEntry[];
  onRequestDelete: (entry: PromptHistoryEntry) => void;
  onRetry: () => void;
  status: PromptHistoryStatus;
}) {
  const [search, setSearch] = useState("");
  const headingId = useId();
  const home = useHomeDirectory();
  const now = useMinuteClock();
  const needle = search.trim().toLowerCase();

  const visibleEntries = useMemo(() => {
    if (needle.length === 0) {
      return entries;
    }
    return entries.filter(
      (entry) =>
        entry.content.toLowerCase().includes(needle) ||
        entry.destinationPath?.toLowerCase().includes(needle)
    );
  }, [entries, needle]);

  if (status.type === "loading") {
    return <ListSkeleton rows={4} />;
  }
  if (status.type === "error") {
    return <ErrorState message={status.message} onRetry={onRetry} />;
  }
  if (entries.length === 0) {
    return (
      <EmptyState
        description="Prompts you save or capture are kept here, ready to copy."
        icon={History}
        title="No saved prompts yet"
      />
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <header className="flex items-center gap-3">
        <Heading id={headingId} level={2} size="heading-4">
          History
        </Heading>
        <Text
          aria-live="polite"
          as="span"
          className="flex-1"
          numeric
          size="label"
          tone="muted"
        >
          {countLabel(visibleEntries.length, entries.length, needle.length > 0)}
        </Text>
        <InputGroup className="w-64" size="sm">
          <InputGroupAddon>
            <Search aria-hidden="true" className="size-3.5" />
          </InputGroupAddon>
          <Input
            aria-label="Search prompts"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search.length > 0) {
                event.preventDefault();
                setSearch("");
              }
            }}
            placeholder="Search prompts and folders"
            type="search"
            value={search}
          />
          {search.length > 0 ? (
            <InputGroupAddon>
              <IconButton
                label="Clear search"
                onClick={() => setSearch("")}
                size="xs"
              >
                <X />
              </IconButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </header>

      {visibleEntries.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setSearch("")} size="sm" variant="surface">
              Clear search
            </Button>
          }
          description={`No saved prompt or folder contains “${search.trim()}”.`}
          icon={SearchX}
          title="No prompts found"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visibleEntries.map((entry) => (
            <PromptHistoryItem
              entry={entry}
              home={home}
              key={entry.id}
              now={now}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
