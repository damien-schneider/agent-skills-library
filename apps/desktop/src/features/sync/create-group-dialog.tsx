import { Alert, AlertDescription, AlertTitle } from "@ctrl-ui/react/ui/alert";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrl-ui/react/ui/dialog";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@ctrl-ui/react/ui/field";
import { Input } from "@ctrl-ui/react/ui/input";
import {
  Radio,
  RadioGroup,
  RadioGroupItem,
} from "@ctrl-ui/react/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrl-ui/react/ui/select";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { CircleAlert } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { fileTitle } from "@/features/library/library-model";
import { useHomeDirectory } from "@/lib/home-dir";
import { createSyncGroup, listFiles, toIpcError } from "@/lib/ipc";
import type { SyncStrategy } from "@/lib/ipc-types";

import { FilePicker, type FilesState } from "./file-picker";

const DIALOG_STYLE = { "--cui-popup-dialog-max-inline-size": "48rem" } as const;

const MIN_FILES = 2;

const SOURCE_PLACEHOLDER = "Select files first";

const STRATEGIES: { value: SyncStrategy; label: string; detail: string }[] = [
  {
    value: "copy",
    label: "Separate files",
    detail: "Real files with the source's content.",
  },
  {
    value: "symlink",
    label: "Symlinks",
    detail: "Links pointing at the source.",
  },
];

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent style={DIALOG_STYLE}>
        <CreateGroupForm
          onCreated={() => {
            onCreated();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function selectionHint(count: number): string {
  if (count === 0) {
    return "Select the files that should stay identical.";
  }
  if (count < MIN_FILES) {
    return "Select at least one more file.";
  }
  return `${count} files selected`;
}

/** Mounted with the dialog, so every opening starts from an empty form. */
function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const home = useHomeDirectory();
  const nameId = useId();
  const sourceId = useId();
  const [state, setState] = useState<FilesState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickedSourceId, setPickedSourceId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<SyncStrategy>("copy");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", files: await listFiles() });
    } catch (cause) {
      setState({ status: "error", message: toIpcError(cause).message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const files = state.status === "ready" ? state.files : [];
  const selected = selectedIds.flatMap(
    (id) => files.find((file) => String(file.id) === id) ?? []
  );
  // The first file picked is the source until another one is chosen.
  const source =
    selected.find((file) => String(file.id) === pickedSourceId) ??
    selected.at(0) ??
    null;
  const canCreate = source !== null && selected.length >= MIN_FILES;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(canCreate && source) || creating) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createSyncGroup({
        name: name.trim() || fileTitle(source),
        canonicalFileId: source.id,
        memberFileIds: selected
          .filter((file) => file.id !== source.id)
          .map((file) => file.id),
        strategy,
      });
      onCreated();
    } catch (cause) {
      setError(toIpcError(cause).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        handleSubmit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>New sync group</DialogTitle>
        <DialogDescription>
          Files in a group follow one source. Nothing is written until you apply
          a sync.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div className="flex min-w-0 items-start gap-6">
          <FieldSet className="min-w-0 flex-1 gap-2">
            <FieldLegend>Files</FieldLegend>
            <FilePicker
              home={home}
              onQueryChange={setQuery}
              onRetry={load}
              onSelectedChange={setSelectedIds}
              query={query}
              selectedIds={selectedIds}
              state={state}
            />
            {files.length > 0 ? (
              <Text aria-live="polite" as="p" size="label" tone="muted">
                {selectionHint(selected.length)}
              </Text>
            ) : null}
          </FieldSet>

          <div className="flex w-64 shrink-0 flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={sourceId}>Source</FieldLabel>
              <Select
                disabled={selected.length === 0}
                onValueChange={setPickedSourceId}
                value={source ? String(source.id) : null}
              >
                <SelectTrigger className="w-full" id={sourceId}>
                  <SelectValue placeholder={SOURCE_PLACEHOLDER}>
                    {(value: string) => {
                      const file = selected.find(
                        (candidate) => String(candidate.id) === value
                      );
                      // The renderer also runs with no value, where it replaces the placeholder.
                      return file ? (
                        <Text as="span" mono size="label">
                          {displayPath(file.path, home)}
                        </Text>
                      ) : (
                        SOURCE_PLACEHOLDER
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-md">
                  {selected.map((file) => (
                    <SelectItem key={file.id} value={String(file.id)}>
                      <Text as="span" className="break-all" mono size="label">
                        {displayPath(file.path, home)}
                      </Text>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <FieldSet className="gap-1">
              <FieldLegend>Keep the others as</FieldLegend>
              <RadioGroup<SyncStrategy>
                aria-label="Keep the others as"
                onValueChange={setStrategy}
                value={strategy}
              >
                {STRATEGIES.map((option) => (
                  <StrategyOption key={option.value} option={option} />
                ))}
              </RadioGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input
                id={nameId}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  source ? fileTitle(source) : "Named after the source"
                }
                value={name}
              />
            </Field>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>The group was not created</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </DialogBody>

      <DialogFooter>
        <DialogClose disabled={creating}>Cancel</DialogClose>
        <Button
          disabled={!canCreate || creating}
          tone="primary"
          type="submit"
          variant="solid"
        >
          {creating ? <Spinner /> : null}
          Create group
        </Button>
      </DialogFooter>
    </form>
  );
}

function StrategyOption({ option }: { option: (typeof STRATEGIES)[number] }) {
  const id = useId();
  return (
    <RadioGroupItem htmlFor={id}>
      <Radio aria-label={option.label} id={id} value={option.value} />
      <span className="flex flex-col">
        <Text tone="foreground" weight="medium">
          {option.label}
        </Text>
        <Text size="caption" tone="muted">
          {option.detail}
        </Text>
      </span>
    </RadioGroupItem>
  );
}
