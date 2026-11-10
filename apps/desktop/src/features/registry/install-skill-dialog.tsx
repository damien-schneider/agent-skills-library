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
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Text } from "@ctrl-ui/react/ui/typography";
import { slugifySkillName } from "@skills-agent-library/skills-core/install-targets";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { displayPath } from "@/features/destinations/destination-path";
import {
  SkillLocationField,
  useSkillLocations,
} from "@/features/library/skill-location-field";
import { skillFilePath } from "@/features/library/skill-locations";
import type { LibraryIndex } from "@/features/library/use-library-index";
import { convexSiteUrl } from "@/lib/convex";
import { installFiles, toIpcError } from "@/lib/ipc";

export interface InstallableSkill {
  name: string;
  markdown: string;
  githubOwner?: string;
  githubRepo?: string;
  skillSlug?: string;
}

type InstallTarget = Pick<LibraryIndex, "files" | "roots">;

async function recordInstall(skill: InstallableSkill) {
  const site = convexSiteUrl();
  if (!(site && skill.githubOwner && skill.githubRepo && skill.skillSlug)) {
    return;
  }
  try {
    await fetch(`${site}/api/installs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: skill.githubOwner,
        repo: skill.githubRepo,
        skill: skill.skillSlug,
        agent: "unknown",
      }),
    });
  } catch {
    // the install already happened locally; the counter is best effort
  }
}

/** The form lives only while the dialog is open, so every install starts clean. */
function InstallForm({
  skill,
  index,
  onClose,
  onInstalled,
}: {
  skill: InstallableSkill;
  index: InstallTarget;
  onClose: () => void;
  onInstalled: (fileId: number) => void;
}) {
  const { home, locations } = useSkillLocations(index.files, index.roots);
  const [picked, setPicked] = useState<string | null>(null);
  const [existingPath, setExistingPath] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const location = picked ?? locations[0]?.path ?? null;
  // A name made only of symbols slugs to nothing; the registry's own slug then names the folder.
  const folderName =
    slugifySkillName(skill.name) || slugifySkillName(skill.skillSlug ?? "");
  const path =
    location === null || folderName === ""
      ? null
      : skillFilePath(location, folderName);
  const replacing = path !== null && existingPath === path;
  const source =
    skill.githubOwner && skill.githubRepo
      ? `${skill.githubOwner}/${skill.githubRepo}`
      : null;

  const install = async () => {
    if (path === null || location === null) {
      return;
    }
    setInstalling(true);
    setFailure(null);
    try {
      const result = await installFiles(
        [{ path, content: skill.markdown }],
        replacing
      );
      if (result.written.length === 0) {
        setExistingPath(path);
        return;
      }
      toast.success(`Installed ${skill.name}`, {
        description: displayPath(path, home),
      });
      onClose();
      const [fileId] = result.fileIds;
      if (fileId !== undefined) {
        onInstalled(fileId);
      }
      await recordInstall(skill);
    } catch (cause) {
      const error = toIpcError(cause);
      setFailure(
        error.code === "outside_roots"
          ? `${displayPath(location, home)} is not inside a folder the app indexes. Add it in Settings first.`
          : error.message
      );
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Install {skill.name}</DialogTitle>
        {source === null ? null : (
          <DialogDescription>From {source}</DialogDescription>
        )}
      </DialogHeader>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault();
          install();
        }}
      >
        <DialogBody className="flex flex-col gap-4">
          <SkillLocationField
            disabled={installing}
            files={index.files}
            onChange={setPicked}
            roots={index.roots}
            value={location}
          />
          {path === null ? null : (
            <div className="flex flex-col gap-1">
              <Text size="label" tone="muted">
                Installs to
              </Text>
              <Text className="break-all" mono size="label">
                {displayPath(path, home)}
              </Text>
            </div>
          )}
          {folderName === "" ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>This skill cannot be installed</AlertTitle>
              <AlertDescription>
                Its name has no letters or digits to name a folder with.
              </AlertDescription>
            </Alert>
          ) : null}
          {replacing ? (
            <Alert>
              <TriangleAlert />
              <AlertTitle>
                A skill named {folderName} is already here
              </AlertTitle>
              <AlertDescription>
                Replacing it overwrites its SKILL.md, and that cannot be undone.
              </AlertDescription>
            </Alert>
          ) : null}
          {failure === null ? null : (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>The skill was not installed</AlertTitle>
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose disabled={installing}>Cancel</DialogClose>
          <Button
            disabled={installing || path === null}
            tone={replacing ? "danger" : "primary"}
            type="submit"
            variant="solid"
          >
            {installing ? <Spinner label="Installing" /> : null}
            {replacing ? "Replace existing skill" : "Install"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/** Writes a registry skill into one of the folders skills already live in. */
export function InstallSkillDialog({
  skill,
  index,
  open,
  onOpenChange,
  onInstalled,
}: {
  skill: InstallableSkill | null;
  index: InstallTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: (fileId: number) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        {skill === null ? null : (
          <InstallForm
            index={index}
            onClose={() => onOpenChange(false)}
            onInstalled={onInstalled}
            skill={skill}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
