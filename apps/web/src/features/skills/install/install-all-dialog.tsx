"use client";

import {
  AGENT_TOOLS,
  type AgentTool,
  detectOS,
  getInstallPath,
  getScopeOptions,
  type InstallScope,
  type OperatingSystem,
  slugifySkillName,
} from "@skills-agent-library/skills-core/install-targets";
import { Apple, Check, Copy, Info, Monitor, Terminal } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";

interface SkillData {
  name: string;
  markdown: string;
}

interface InstallAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: SkillData[];
}

type CopiedState = "command" | null;

const OS_CONFIG: Record<
  OperatingSystem,
  { label: string; icon: typeof Apple }
> = {
  macos: { label: "macOS", icon: Apple },
  linux: { label: "Linux", icon: Terminal },
  windows: { label: "Windows", icon: Monitor },
};

const TOOL_ORDER: AgentTool[] = ["claude", "codex", "cursor", "generic"];

const FLAT_FILE_TOOLS: AgentTool[] = ["cursor"];

function usesFlatFileFormat(tool: AgentTool): boolean {
  return FLAT_FILE_TOOLS.includes(tool);
}

function extractParentDirectory(filePath: string, os: OperatingSystem): string {
  const separator = os === "windows" ? "\\" : "/";
  const parts = filePath.split(separator);
  parts.pop();
  return parts.join(separator);
}

function generateBatchInstallCommand(
  skills: SkillData[],
  tool: AgentTool,
  scope: InstallScope,
  os: OperatingSystem
): { command: string; shellType: "bash" | "powershell" } {
  const isFlatFile = usesFlatFileFormat(tool);

  if (os === "windows") {
    const commands = skills.map((skill) => {
      const safeName = slugifySkillName(skill.name);
      const installPath = getInstallPath(tool, scope, os, safeName);
      const escapedContent = skill.markdown
        .replace(/`/g, "``")
        .replace(/\n"@/g, '\n`"@');

      if (isFlatFile) {
        const parentDir = extractParentDirectory(installPath, os);
        return [
          `New-Item -ItemType Directory -Force -Path "${parentDir}" | Out-Null`,
          `$content = @"`,
          escapedContent,
          `"@`,
          `Set-Content -Path "${installPath}" -Value $content -Encoding UTF8`,
          `Write-Host "✓ Installed ${safeName}" -ForegroundColor Green`,
        ].join("\n");
      }

      const skillFilePath = `${installPath}\\SKILL.md`;
      return [
        `New-Item -ItemType Directory -Force -Path "${installPath}" | Out-Null`,
        `$content = @"`,
        escapedContent,
        `"@`,
        `Set-Content -Path "${skillFilePath}" -Value $content -Encoding UTF8`,
        `Write-Host "✓ Installed ${safeName}" -ForegroundColor Green`,
      ].join("\n");
    });

    return {
      command: [
        `Write-Host "Installing ${skills.length} skills..." -ForegroundColor Cyan`,
        "",
        ...commands,
        "",
        `Write-Host ""`,
        `Write-Host "✓ All ${skills.length} skills installed!" -ForegroundColor Green`,
      ].join("\n\n"),
      shellType: "powershell",
    };
  }

  const commands = skills.map((skill) => {
    const safeName = slugifySkillName(skill.name);
    const installPath = getInstallPath(tool, scope, os, safeName);

    if (isFlatFile) {
      const parentDir = extractParentDirectory(installPath, os);
      return [
        `mkdir -p "${parentDir}"`,
        `cat << 'EOF_SKILL_CONTENT' > "${installPath}"`,
        skill.markdown,
        "EOF_SKILL_CONTENT",
        `echo "✓ Installed ${safeName}"`,
      ].join("\n");
    }

    const skillFilePath = `${installPath}/SKILL.md`;
    return [
      `mkdir -p "${installPath}"`,
      `cat << 'EOF_SKILL_CONTENT' > "${skillFilePath}"`,
      skill.markdown,
      "EOF_SKILL_CONTENT",
      `echo "✓ Installed ${safeName}"`,
    ].join("\n");
  });

  return {
    command: [
      `echo "Installing ${skills.length} skills..."`,
      "",
      ...commands,
      "",
      `echo ""`,
      `echo "✓ All ${skills.length} skills installed!"`,
    ].join("\n\n"),
    shellType: "bash",
  };
}

export function InstallAllDialog({
  open,
  onOpenChange,
  skills,
}: InstallAllDialogProps) {
  const [selectedTool, setSelectedTool] = useState<AgentTool>("claude");
  const [selectedScope, setSelectedScope] = useState<InstallScope>("project");
  const [selectedOS, setSelectedOS] = useState<OperatingSystem>("macos");
  const [copiedState, setCopiedState] = useState<CopiedState>(null);

  useEffect(() => {
    if (open) {
      setSelectedOS(detectOS());
    }
  }, [open]);

  useEffect(() => {
    const scopeOptions = getScopeOptions(selectedTool);
    const currentScopeValid = scopeOptions.some((s) => s.id === selectedScope);
    if (!currentScopeValid && scopeOptions.length > 0) {
      setSelectedScope(scopeOptions[0].id);
    }
  }, [selectedTool, selectedScope]);

  const { command, shellType } = useMemo(
    () =>
      generateBatchInstallCommand(
        skills,
        selectedTool,
        selectedScope,
        selectedOS
      ),
    [skills, selectedTool, selectedScope, selectedOS]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopiedState("command");
    setTimeout(() => setCopiedState(null), 2000);
  }, [command]);

  const scopeOptions = getScopeOptions(selectedTool);

  if (skills.length === 0) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-0"
        showCloseButton
      >
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex h-full flex-col"
          initial={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="shrink-0 border-border border-b px-6 pt-6 pb-4">
            <DialogTitle
              className="mb-1 font-semibold text-lg tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Install All Skills
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Install{" "}
              <span className="font-medium text-foreground">
                {skills.length} skill{skills.length === 1 ? "" : "s"}
              </span>{" "}
              from your library
            </DialogDescription>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-6">
              <div className="space-y-3">
                <p className="font-medium text-sm">Operating System</p>
                <div className="flex gap-2">
                  {(
                    Object.entries(OS_CONFIG) as [
                      OperatingSystem,
                      (typeof OS_CONFIG)[OperatingSystem],
                    ][]
                  ).map(([os, { label, icon: Icon }]) => (
                    <button
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-medium text-sm transition-all",
                        selectedOS === os
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                      )}
                      key={os}
                      onClick={() => setSelectedOS(os)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-medium text-sm">Target Tool</p>
                <div className="grid grid-cols-2 gap-2">
                  {TOOL_ORDER.map((toolId) => {
                    const tool = AGENT_TOOLS[toolId];
                    return (
                      <button
                        className={cn(
                          "group relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all",
                          selectedTool === toolId
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
                        )}
                        key={toolId}
                        onClick={() => setSelectedTool(toolId)}
                        type="button"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-lg">{tool.icon}</span>
                          {selectedTool === toolId && (
                            <motion.div
                              animate={{ scale: 1 }}
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                              initial={{ scale: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 30,
                              }}
                            >
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </div>
                        <span
                          className={cn(
                            "font-medium text-sm",
                            selectedTool === toolId
                              ? "text-foreground"
                              : "text-foreground/80"
                          )}
                        >
                          {tool.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-medium text-sm">Install Scope</p>
                <div className="flex gap-2">
                  {scopeOptions.map((scope) => (
                    <button
                      className={cn(
                        "flex-1 rounded-xl border px-4 py-2.5 text-center font-medium text-sm transition-all",
                        selectedScope === scope.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                      )}
                      key={scope.id}
                      onClick={() => setSelectedScope(scope.id)}
                      type="button"
                    >
                      {scope.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    This will install {skills.length} skill
                    {skills.length === 1 ? "" : "s"}:{" "}
                    {skills
                      .slice(0, 3)
                      .map((s) => slugifySkillName(s.name))
                      .join(", ")}
                    {skills.length > 3 && ` and ${skills.length - 3} more`}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between border-border border-b bg-muted/50 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-xs",
                        shellType === "powershell"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      )}
                    >
                      {shellType === "powershell" ? "PowerShell" : "Bash"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Batch install command
                    </span>
                  </div>
                  <Button
                    className="gap-1.5"
                    onClick={handleCopy}
                    size="xs"
                    variant={copiedState === "command" ? "default" : "outline"}
                  >
                    {copiedState === "command" ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <ScrollArea className="max-h-64">
                  <pre
                    className={cn(
                      "p-4 font-mono text-xs leading-relaxed",
                      shellType === "powershell"
                        ? "text-blue-200 dark:text-blue-300"
                        : "text-emerald-200 dark:text-emerald-300"
                    )}
                    style={{
                      background:
                        shellType === "powershell"
                          ? "linear-gradient(145deg, rgba(59, 130, 246, 0.05) 0%, rgba(30, 41, 59, 0.8) 100%)"
                          : "linear-gradient(145deg, rgba(16, 185, 129, 0.05) 0%, rgba(30, 41, 59, 0.8) 100%)",
                    }}
                  >
                    <code className="text-foreground">{command}</code>
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </ScrollArea>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
