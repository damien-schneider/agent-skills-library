import { Field, FieldError, FieldLabel } from "@ctrl-ui/react/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrl-ui/react/ui/select";
import { Separator } from "@ctrl-ui/react/ui/separator";
import { Text } from "@ctrl-ui/react/ui/typography";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { useId, useMemo, useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import { useHomeDirectory } from "@/lib/home-dir";
import type { FileRow, Root } from "@/lib/ipc-types";

import { isInsideRoots, skillLocations } from "./skill-locations";

const BROWSE_VALUE = "__browse__";

/** The folders a skill can be created in, read from where skills already live. */
export function useSkillLocations(
  files: readonly FileRow[],
  roots: readonly Root[]
) {
  const home = useHomeDirectory();
  return useMemo(
    () => ({ home, locations: skillLocations(files, roots, home) }),
    [files, roots, home]
  );
}

/**
 * Picks the directory a skill folder is created in. `value` is that directory's
 * absolute path; a folder chosen with the system dialog joins the list for the
 * lifetime of the field.
 */
export function SkillLocationField({
  files,
  roots,
  value,
  onChange,
  disabled,
}: {
  files: readonly FileRow[];
  roots: readonly Root[];
  value: string | null;
  onChange: (path: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { home, locations } = useSkillLocations(files, roots);
  const [browsed, setBrowsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paths = locations.map((location) => location.path);
  if (browsed !== null && !paths.includes(browsed)) {
    paths.push(browsed);
  }
  if (value !== null && !paths.includes(value)) {
    paths.push(value);
  }

  const browse = async () => {
    const picked = await openFolderDialog({
      directory: true,
      multiple: false,
      defaultPath: value ?? home ?? undefined,
      title: "Choose where skills are stored",
    });
    if (typeof picked !== "string") {
      return;
    }
    if (!isInsideRoots(picked, roots)) {
      setError(
        `${displayPath(picked, home)} is not inside a folder the app indexes. Add it in Settings first.`
      );
      return;
    }
    setError(null);
    setBrowsed(picked);
    onChange(picked);
  };

  return (
    <Field invalid={error !== null}>
      <FieldLabel htmlFor={id}>Location</FieldLabel>
      <Select
        disabled={disabled}
        onValueChange={(next) => {
          if (next === BROWSE_VALUE) {
            browse();
            return;
          }
          setError(null);
          onChange(next);
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder="Choose a folder">
            {(selected: string | null) =>
              selected === null ? (
                "Choose a folder"
              ) : (
                <Text as="span" mono>
                  {displayPath(selected, home)}
                </Text>
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {paths.map((path) => (
            <SelectItem key={path} value={path}>
              <Text as="span" mono>
                {displayPath(path, home)}
              </Text>
            </SelectItem>
          ))}
          <Separator />
          <SelectItem value={BROWSE_VALUE}>Choose another folder…</SelectItem>
        </SelectContent>
      </Select>
      <FieldError match>{error}</FieldError>
    </Field>
  );
}
