import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@ctrl-ui/react/ui/alert";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@ctrl-ui/react/ui/field";
import { Input } from "@ctrl-ui/react/ui/input";
import { Textarea } from "@ctrl-ui/react/ui/textarea";
import { Text } from "@ctrl-ui/react/ui/typography";
import { validateSkillName } from "@skills-agent-library/skills-core/install-targets";
import { useId, useMemo } from "react";

import {
  type FrontmatterKey,
  readFrontmatterFields,
} from "@/lib/frontmatter-fields";
import type { FileKind, FileRow } from "@/lib/ipc-types";

import { parentPath, pathName } from "../library-model";

/** Agents read at most this much of a skill's description. */
const DESCRIPTION_LIMIT = 1024;
const DESCRIPTION_COUNTER_FROM = 900;
const LINE_BREAKS_PATTERN = /\s*\n\s*/g;

/** The frontmatter fields agents read for each kind of file. */
const FIELDS_BY_KIND: Record<FileKind, readonly FrontmatterKey[]> = {
  skill: ["name", "description"],
  "claude-agent": ["name", "description"],
  "cursor-rule": ["description"],
  "agents-md": [],
  "claude-md": [],
  "gemini-md": [],
};

function nameProblem(kind: FileKind, name: string): string | null {
  if (name === "") {
    return "A name is required.";
  }
  if (kind !== "skill") {
    return null;
  }
  const [problem] = validateSkillName(name).errors;
  return problem ? `${problem}.` : null;
}

function descriptionProblem(
  kind: FileKind,
  description: string
): string | null {
  if (kind === "cursor-rule") {
    return null;
  }
  if (description.trim() === "") {
    return "Agents decide when to use this from its description.";
  }
  if (kind === "skill" && description.length > DESCRIPTION_LIMIT) {
    return `Agents read the first ${DESCRIPTION_LIMIT} characters only.`;
  }
  return null;
}

function NameField({
  file,
  name,
  onChange,
}: {
  file: FileRow;
  name: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const problem = nameProblem(file.kind, name);
  const folder = pathName(parentPath(file.path));
  const differsFromFolder =
    file.kind === "skill" && problem === null && name !== folder;

  return (
    <Field invalid={problem !== null}>
      <FieldLabel htmlFor={id}>Name</FieldLabel>
      <Input
        autoCapitalize="off"
        autoCorrect="off"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        value={name}
      />
      <FieldError match>{problem}</FieldError>
      {differsFromFolder ? (
        <FieldDescription>
          Agents expect a skill to be named after its folder.{" "}
          <Button onClick={() => onChange(folder)} size="xs" variant="link">
            Use “{folder}”
          </Button>
        </FieldDescription>
      ) : null}
    </Field>
  );
}

function DescriptionField({
  description,
  kind,
  onChange,
}: {
  description: string;
  kind: FileKind;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const problem = descriptionProblem(kind, description);
  const showsCount =
    kind === "skill" && description.length >= DESCRIPTION_COUNTER_FROM;

  return (
    <Field invalid={problem !== null}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>Description</FieldLabel>
        {showsCount ? (
          <Text
            numeric
            size="caption"
            tone={
              description.length > DESCRIPTION_LIMIT ? "destructive" : "muted"
            }
          >
            {description.length} / {DESCRIPTION_LIMIT}
          </Text>
        ) : null}
      </div>
      <Textarea
        className="field-sizing-content"
        id={id}
        // A description is one paragraph: YAML would need a block scalar for anything else.
        onChange={(event) =>
          onChange(event.target.value.replace(LINE_BREAKS_PATTERN, " "))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        placeholder="What this does, and when an agent should reach for it."
        rows={2}
        value={description}
      />
      <FieldError match>{problem}</FieldError>
    </Field>
  );
}

/**
 * The frontmatter fields agents rely on, as inputs. Everything else in the
 * frontmatter is left exactly as written and stays editable in source.
 */
export function MetadataFields({
  file,
  frontmatter,
  onChange,
  onEditSource,
}: {
  file: FileRow;
  frontmatter: string | null;
  onChange: (key: FrontmatterKey, value: string) => void;
  onEditSource: () => void;
}) {
  const fields = useMemo(
    () => readFrontmatterFields(frontmatter),
    [frontmatter]
  );
  const keys = FIELDS_BY_KIND[file.kind];
  if (keys.length === 0) {
    return null;
  }

  if (fields.problem !== null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>The frontmatter is not valid YAML</AlertTitle>
        <AlertDescription>
          {fields.problem}. Agents may skip this file until it is fixed.
        </AlertDescription>
        <AlertAction>
          <Button onClick={onEditSource} size="sm" variant="surface">
            Fix in source
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  return (
    <FieldGroup>
      {keys.includes("name") ? (
        <NameField
          file={file}
          name={fields.name}
          onChange={(value) => onChange("name", value)}
        />
      ) : null}
      <DescriptionField
        description={fields.description}
        kind={file.kind}
        onChange={(value) => onChange("description", value)}
      />
      {fields.otherKeys.length > 0 ? (
        <Text size="caption" tone="muted">
          Also set: {fields.otherKeys.join(", ")}.{" "}
          <Button onClick={onEditSource} size="xs" variant="link">
            Edit in source
          </Button>
        </Text>
      ) : null}
    </FieldGroup>
  );
}
