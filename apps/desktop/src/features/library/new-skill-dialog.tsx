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
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@ctrl-ui/react/ui/field";
import { Input } from "@ctrl-ui/react/ui/input";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Textarea } from "@ctrl-ui/react/ui/textarea";
import { Text } from "@ctrl-ui/react/ui/typography";
import {
  slugifySkillName,
  validateSkillName,
} from "@skills-agent-library/skills-core/install-targets";
import { useId, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { writeFrontmatterField } from "@/lib/frontmatter-fields";
import { installFiles, toIpcError } from "@/lib/ipc";
import type { FileRow, Root } from "@/lib/ipc-types";

import { parentPath } from "./library-model";
import { SkillLocationField, useSkillLocations } from "./skill-location-field";
import { skillFilePath } from "./skill-locations";

const DESCRIPTION_LIMIT = 1024;

export interface NewSkillDialogProps {
  files: readonly FileRow[];
  /** Receives the id of the new file once it is written. */
  onCreated: (fileId: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  roots: readonly Root[];
  /** The open file: a new skill starts next to the skill being looked at. */
  selectedFile: FileRow | null;
}

function skillDocument(name: string, title: string, description: string) {
  const named = writeFrontmatterField(null, "name", name);
  const frontmatter = writeFrontmatterField(named, "description", description);
  return `---\n${frontmatter}\n---\n\n# ${title}\n`;
}

/** The dialog unmounts its content when it closes, so every new skill starts clean. */
function NewSkillForm({
  files,
  onClose,
  onCreated,
  roots,
  selectedFile,
}: Pick<
  NewSkillDialogProps,
  "files" | "onCreated" | "roots" | "selectedFile"
> & {
  onClose: () => void;
}) {
  const nameId = useId();
  const descriptionId = useId();
  const { home, locations } = useSkillLocations(files, roots);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const neighbour =
    selectedFile?.kind === "skill"
      ? parentPath(parentPath(selectedFile.path))
      : null;
  const location = picked ?? neighbour ?? locations[0]?.path ?? null;
  const name = slugifySkillName(title);
  const path =
    location === null || name === "" ? null : skillFilePath(location, name);
  const exists = path !== null && files.some((file) => file.path === path);

  const [nameRule] = name === "" ? [] : validateSkillName(name).errors;
  let nameProblem: string | null = null;
  if (exists) {
    nameProblem = `A skill named “${name}” already exists in this folder.`;
  } else if (nameRule) {
    nameProblem = `${nameRule}.`;
  } else if (attempted && name === "") {
    nameProblem = "Give the skill a name with letters or digits.";
  }

  let descriptionProblem: string | null = null;
  if (description.length > DESCRIPTION_LIMIT) {
    descriptionProblem = `Agents read the first ${DESCRIPTION_LIMIT} characters only.`;
  } else if (attempted && description.trim() === "") {
    descriptionProblem =
      "Agents decide when to use a skill from its description.";
  }

  const create = async () => {
    setAttempted(true);
    const isReady =
      path !== null &&
      !exists &&
      nameRule === undefined &&
      description.trim() !== "" &&
      description.length <= DESCRIPTION_LIMIT;
    if (!isReady) {
      return;
    }
    setCreating(true);
    setFailure(null);
    try {
      const result = await installFiles(
        [
          {
            path,
            content: skillDocument(name, title.trim(), description.trim()),
          },
        ],
        false
      );
      const [fileId] = result.fileIds;
      if (fileId === undefined) {
        setFailure("A file already exists at that path.");
        return;
      }
      onClose();
      onCreated(fileId);
    } catch (cause) {
      const error = toIpcError(cause);
      setFailure(
        error.code === "outside_roots"
          ? "That folder is not one the app indexes. Add it in Settings first."
          : error.message
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        create();
      }}
    >
      <DialogHeader>
        <DialogTitle>New skill</DialogTitle>
        <DialogDescription>
          A folder with a SKILL.md that agents load when its description matches
          the task.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4">
        <Field invalid={nameProblem !== null}>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input
            autoCapitalize="off"
            autoCorrect="off"
            autoFocus
            disabled={creating}
            id={nameId}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="pdf-forms"
            spellCheck={false}
            value={title}
          />
          <FieldError match>{nameProblem}</FieldError>
        </Field>
        <Field invalid={descriptionProblem !== null}>
          <FieldLabel htmlFor={descriptionId}>Description</FieldLabel>
          <Textarea
            className="field-sizing-content"
            disabled={creating}
            id={descriptionId}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What it does, and when an agent should reach for it."
            rows={3}
            value={description}
          />
          <FieldError match>{descriptionProblem}</FieldError>
        </Field>
        <SkillLocationField
          disabled={creating}
          files={files}
          onChange={setPicked}
          roots={roots}
          value={location}
        />
        {path === null ? null : (
          <Field>
            <FieldDescription>Creates</FieldDescription>
            <Text className="break-all" mono size="label">
              {displayPath(path, home)}
            </Text>
          </Field>
        )}
        {failure === null ? null : (
          <Alert variant="destructive">
            <AlertTitle>The skill was not created</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose disabled={creating}>Cancel</DialogClose>
        <Button
          disabled={creating}
          tone="primary"
          type="submit"
          variant="solid"
        >
          {creating ? <Spinner label="Creating" /> : null}
          Create skill
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NewSkillDialog({
  files,
  onCreated,
  onOpenChange,
  open,
  roots,
  selectedFile,
}: NewSkillDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <NewSkillForm
          files={files}
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
          roots={roots}
          selectedFile={selectedFile}
        />
      </DialogContent>
    </Dialog>
  );
}
