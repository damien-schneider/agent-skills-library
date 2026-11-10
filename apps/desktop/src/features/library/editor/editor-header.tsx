import { Badge } from "@ctrl-ui/react/ui/badge";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrl-ui/react/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrl-ui/react/ui/hover-card";
import { Kbd } from "@ctrl-ui/react/ui/kbd";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { toast } from "@ctrl-ui/react/ui/toast";
import { Toggle, ToggleGroup } from "@ctrl-ui/react/ui/toggle";
import { Heading, Text } from "@ctrl-ui/react/ui/typography";
import { targetLabel } from "@skills-agent-library/skills-core/scan-targets";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Ellipsis, Sparkles } from "lucide-react";

import { displayPath } from "@/features/destinations/destination-path";
import { useHomeDirectory } from "@/lib/home-dir";
import type { FileRow } from "@/lib/ipc-types";
import { IconButton } from "@/shared/components/icon-button";

import { FileKindIcon } from "../file-kind";
import { fileTitle } from "../library-model";
import type { EditorMode, UseFileContent } from "../use-file-content";

const EDITOR_MODES: readonly EditorMode[] = ["rich", "raw"];

function SaveControls({
  editor,
  onReview,
}: {
  editor: UseFileContent;
  onReview: () => void;
}) {
  if (editor.saving) {
    return (
      <div className="flex items-center gap-2">
        <Spinner label="Saving" size="xs" />
        <Text size="caption" tone="muted">
          Saving…
        </Text>
      </div>
    );
  }
  if (!editor.dirty) {
    return (
      <Text role="status" size="caption" tone="muted">
        Saved
      </Text>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <output className="sr-only">Unsaved changes</output>
      <Button onClick={onReview} size="sm" variant="ghost">
        Review
      </Button>
      <Button
        onClick={() => editor.save()}
        size="sm"
        tone="primary"
        variant="solid"
      >
        Save
        <Kbd>⌘S</Kbd>
      </Button>
    </div>
  );
}

function ModeToggle({ editor }: { editor: UseFileContent }) {
  return (
    <ToggleGroup
      aria-label="Editor view"
      onValueChange={(pressed) => {
        const next = EDITOR_MODES.find(
          (mode) => mode !== editor.mode && pressed.includes(mode)
        );
        if (next && !editor.setMode(next)) {
          toast.info("This file stays in source", {
            description:
              "The visual editor could not show it without changing its formatting.",
          });
        }
      }}
      value={[editor.mode]}
    >
      <Toggle size="sm" value="rich">
        Visual
      </Toggle>
      <Toggle size="sm" value="raw">
        Source
      </Toggle>
    </ToggleGroup>
  );
}

/** A file reachable through symlinks is one file: say where else an edit lands. */
function AliasBadge({
  aliases,
  home,
}: {
  aliases: string[];
  home: string | null;
}) {
  if (aliases.length === 0) {
    return null;
  }
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Badge render={<button type="button" />} size="sm" variant="outline">
            {aliases.length === 1
              ? "Linked from 1 place"
              : `Linked from ${aliases.length} places`}
          </Badge>
        }
      />
      <HoverCardContent align="start" className="w-96">
        <div className="flex flex-col gap-2">
          <Text size="caption" tone="muted">
            Symlinks point here, so an edit shows up in each of them.
          </Text>
          <ul className="flex flex-col gap-1">
            {aliases.map((alias) => (
              <li key={alias}>
                <Text className="block truncate" mono size="caption">
                  {displayPath(alias, home)}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function MoreMenu({
  favorite,
  file,
  onToggleFavorite,
  onTrash,
}: {
  favorite: boolean;
  file: FileRow;
  onToggleFavorite: (path: string) => Promise<void>;
  onTrash: () => void;
}) {
  const { projectDir } = file;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        iconOnly
        size="sm"
        variant="ghost"
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={async () => {
            try {
              await revealItemInDir(file.path);
            } catch (cause) {
              toast.error("Could not reveal the file", {
                description: String(cause),
              });
            }
          }}
        >
          Reveal in Finder
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            try {
              await writeText(file.path);
              toast.success("Path copied");
            } catch (cause) {
              toast.error("Could not copy the path", {
                description: String(cause),
              });
            }
          }}
        >
          Copy path
        </DropdownMenuItem>
        {projectDir ? (
          <DropdownMenuCheckboxItem
            checked={favorite}
            onCheckedChange={() => onToggleFavorite(projectDir)}
          >
            Keep project at the top
          </DropdownMenuCheckboxItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onTrash} tone="danger">
          Move to Trash…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EditorHeader({
  agentOpen,
  editor,
  favorite,
  file,
  onReview,
  onToggleAgent,
  onToggleFavorite,
  onTrash,
}: {
  agentOpen: boolean;
  editor: UseFileContent;
  favorite: boolean;
  file: FileRow;
  onReview: () => void;
  onToggleAgent: () => void;
  onToggleFavorite: (path: string) => Promise<void>;
  onTrash: () => void;
}) {
  const home = useHomeDirectory();
  return (
    <header
      className="flex h-(--titlebar-height) shrink-0 items-center gap-3 border-b px-4"
      data-tauri-drag-region
    >
      <FileKindIcon
        className="size-4 shrink-0 text-muted-foreground"
        kind={file.kind}
      />
      <div className="flex min-w-0 flex-1 flex-col" data-tauri-drag-region>
        <div className="flex min-w-0 items-center gap-2" data-tauri-drag-region>
          <Heading
            className="min-w-0 truncate"
            data-tauri-drag-region
            level={1}
            size="label"
          >
            {fileTitle(file)}
          </Heading>
          <AliasBadge aliases={file.aliases} home={home} />
        </div>
        <Text
          className="truncate"
          data-tauri-drag-region
          size="caption"
          tone="muted"
        >
          {targetLabel(file.kind)} ·{" "}
          <Text as="span" data-tauri-drag-region mono size="caption">
            {displayPath(file.path, home)}
          </Text>
        </Text>
      </div>
      <SaveControls editor={editor} onReview={onReview} />
      <ModeToggle editor={editor} />
      <IconButton
        active={agentOpen}
        aria-pressed={agentOpen}
        label="Ask AI"
        onClick={onToggleAgent}
      >
        <Sparkles />
      </IconButton>
      <MoreMenu
        favorite={favorite}
        file={file}
        onToggleFavorite={onToggleFavorite}
        onTrash={onTrash}
      />
    </header>
  );
}
