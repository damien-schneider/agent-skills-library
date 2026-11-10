import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ctrl-ui/react/ui/alert";
import { Button } from "@ctrl-ui/react/ui/button";
import { Checkbox } from "@ctrl-ui/react/ui/checkbox";
import {
  CheckboxGroup,
  CheckboxGroupItem,
} from "@ctrl-ui/react/ui/checkbox-group";
import { Input } from "@ctrl-ui/react/ui/input";
import { InputGroup, InputGroupAddon } from "@ctrl-ui/react/ui/input-group";
import { ScrollArea } from "@ctrl-ui/react/ui/scroll-area";
import { Text } from "@ctrl-ui/react/ui/typography";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { CircleAlert, Search } from "lucide-react";
import { useId } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { FileKindIcon } from "@/features/library/file-kind";
import { fileTitle, filterFiles } from "@/features/library/library-model";
import type { FileRow } from "@/lib/ipc-types";
import { ListSkeleton } from "@/shared/components/view-layout";

/** Rendering every indexed file would stall the dialog; the filter narrows it. */
const MAX_LISTED = 200;

/** Shorter in a short window, so the dialog's buttons stay on screen. */
const LIST_MAX_HEIGHT = "min(15rem, 30vh)";

export type FilesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; files: FileRow[] };

/** A filterable checklist of the indexed files; ids are the files' ids as strings. */
export function FilePicker({
  state,
  home,
  query,
  onQueryChange,
  selectedIds,
  onSelectedChange,
  onRetry,
}: {
  state: FilesState;
  home: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  selectedIds: string[];
  onSelectedChange: (ids: string[]) => void;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return <ListSkeleton rows={4} />;
  }

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>The files could not be listed</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
        <AlertAction>
          <Button onClick={onRetry} size="sm" variant="surface">
            Try again
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (state.files.length === 0) {
    return (
      <Text as="p" tone="muted">
        No file is indexed yet. Add a folder in Settings first.
      </Text>
    );
  }

  const matches = filterFiles(state.files, query);
  const listed = matches.slice(0, MAX_LISTED);

  return (
    <>
      <InputGroup size="sm">
        <InputGroupAddon>
          <Search aria-hidden="true" className="size-3.5" />
        </InputGroupAddon>
        <Input
          aria-label="Filter files"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter in the filter narrows the list; it must not create the group.
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
          placeholder="Filter by name or path"
          type="search"
          value={query}
        />
      </InputGroup>

      {listed.length === 0 ? (
        <Text as="p" tone="muted">
          No file matches “{query.trim()}”.
        </Text>
      ) : (
        <ScrollArea maxHeight={LIST_MAX_HEIGHT}>
          <CheckboxGroup
            aria-label="Files to keep in sync"
            indicator="hover"
            onValueChange={onSelectedChange}
            value={selectedIds}
          >
            {listed.map((file) => (
              <FileOption file={file} home={home} key={file.id} />
            ))}
          </CheckboxGroup>
        </ScrollArea>
      )}

      {matches.length > MAX_LISTED ? (
        <Text as="p" size="label" tone="muted">
          Showing the first {MAX_LISTED} of {matches.length}. Filter to narrow
          the list.
        </Text>
      ) : null}
    </>
  );
}

function FileOption({ file, home }: { file: FileRow; home: string | null }) {
  const id = useId();
  const title = fileTitle(file);
  const path = displayPath(file.path, home);
  return (
    <CheckboxGroupItem htmlFor={id}>
      <Checkbox
        aria-label={`${title}, ${path}`}
        id={id}
        value={String(file.id)}
      />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <FileKindIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            kind={file.kind}
          />
          <Text className="truncate" tone="foreground" weight="medium">
            {title}
          </Text>
          <Text className="shrink-0" size="caption" tone="muted">
            {targetLabel(file.kind)}
          </Text>
        </span>
        <Text
          className="truncate"
          mono
          size="caption"
          title={file.path}
          tone="muted"
        >
          {path}
        </Text>
      </span>
    </CheckboxGroupItem>
  );
}
