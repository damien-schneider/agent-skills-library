import {
  AGENT_TOOLS,
  type AgentTool,
  getInstallPath,
  getScopeOptions,
  getToolOptions,
  type InstallScope,
  slugifySkillName,
} from "@skills-agent-library/skills-core/install-targets";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { convexSiteUrl } from "@/lib/convex";
import { installFiles, toIpcError } from "@/lib/ipc";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

export interface InstallableSkill {
  name: string;
  markdown: string;
  githubOwner?: string;
  githubRepo?: string;
  skillSlug?: string;
}

/** Cursor stores a flat `.mdc` file; every other tool gets a SKILL.md in a folder. */
function targetPath(tool: AgentTool, scope: InstallScope, skillName: string) {
  const base = getInstallPath(tool, scope, "macos", skillName);
  return tool === "cursor" ? base : `${base}/SKILL.md`;
}

async function recordInstall(skill: InstallableSkill, tool: AgentTool) {
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
        agent: tool === "generic" ? "unknown" : tool,
      }),
    });
  } catch {
    // the install already happened locally; the counter is best effort
  }
}

export function InstallSkillDialog({
  skill,
  open,
  onOpenChange,
}: {
  skill: InstallableSkill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tool, setTool] = useState<AgentTool>("claude");
  const [scope, setScope] = useState<InstallScope>("user");
  const [overwrite, setOverwrite] = useState(false);
  const [installing, setInstalling] = useState(false);

  const scopes = useMemo(() => getScopeOptions(tool), [tool]);
  const skillName = skill ? slugifySkillName(skill.name) : "";
  const effectiveScope = scopes.some((option) => option.id === scope)
    ? scope
    : (scopes[0]?.id ?? "project");
  const path = skill ? targetPath(tool, effectiveScope, skillName) : "";

  const handleInstall = async () => {
    if (!skill) {
      return;
    }
    setInstalling(true);
    try {
      const result = await installFiles(
        [{ path, content: skill.markdown }],
        overwrite
      );
      if (result.written.length === 0) {
        toast.warning(
          `${path} already exists — enable overwrite to replace it`
        );
      } else {
        toast.success(`Installed to ${result.written[0]}`);
        await recordInstall(skill, tool);
        onOpenChange(false);
      }
    } catch (cause) {
      const error = toIpcError(cause);
      toast.error(
        error.code === "outside_roots"
          ? `${path} is outside every enabled root — add it in Settings first`
          : error.message
      );
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Install {skill?.name}</DialogTitle>
          <DialogDescription>
            The file is written by the app and indexed straight away.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Tool</span>
            <div className="flex flex-wrap gap-2">
              {getToolOptions().map((option) => (
                <Button
                  key={option.id}
                  onClick={() => setTool(option.id)}
                  size="sm"
                  variant={tool === option.id ? "default" : "outline"}
                >
                  {option.name}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {AGENT_TOOLS[tool].description}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Scope</span>
            <div className="flex flex-wrap gap-2">
              {scopes.map((option) => (
                <Button
                  key={option.id}
                  onClick={() => setScope(option.id)}
                  size="sm"
                  variant={effectiveScope === option.id ? "default" : "outline"}
                >
                  {option.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="break-all font-mono text-xs">{path}</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              checked={overwrite}
              className="size-3.5 accent-primary"
              onChange={(event) => setOverwrite(event.target.checked)}
              type="checkbox"
            />
            Overwrite if the file already exists
          </label>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={installing || !skill}
            onClick={() => {
              handleInstall();
            }}
          >
            {installing ? "Installing…" : "Install"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
