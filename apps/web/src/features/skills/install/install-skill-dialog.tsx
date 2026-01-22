"use client";

import {
  Check,
  Copy,
  Download,
  Github,
  Info,
  type LucideIcon,
  Monitor,
  Terminal,
} from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";

import {
  type GeneratedCommand,
  generateCurlCommand,
  generateGitHubCLICommand,
  generateInstallCommand,
} from "./install-commands";
import {
  AGENT_TOOLS,
  type AgentTool,
  detectOS,
  getDisplayPath,
  getScopeOptions,
  type InstallScope,
  type OperatingSystem,
  slugifySkillName,
  validateSkillName,
} from "./install-targets";

interface InstallSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  skillContent: string;
  sourceUrl?: string;
  hasBundle?: boolean;
}

type CopiedState = "command" | "curl" | "github" | null;

type OSButtonOption = "unix" | "windows";

const OS_BUTTONS: Record<
  OSButtonOption,
  { label: string; icon: LucideIcon; os: OperatingSystem }
> = {
  unix: { label: "macOS & Linux", icon: Terminal, os: "macos" },
  windows: { label: "Windows", icon: Monitor, os: "windows" },
};

const TOOL_ORDER: AgentTool[] = ["claude", "codex", "cursor", "generic"];

export function InstallSkillDialog({
  open,
  onOpenChange,
  skillName,
  skillContent,
  sourceUrl,
  hasBundle,
}: InstallSkillDialogProps) {
  const [selectedTool, setSelectedTool] = useState<AgentTool>("claude");
  const [selectedScope, setSelectedScope] = useState<InstallScope>("project");
  const [selectedOS, setSelectedOS] = useState<OperatingSystem>("macos");
  const [copiedState, setCopiedState] = useState<CopiedState>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      const detectedOS = detectOS();
      // Normalize Linux to macOS since they use the same commands
      setSelectedOS(detectedOS === "linux" ? "macos" : detectedOS);
    }
  }, [open]);

  useEffect(() => {
    const scopeOptions = getScopeOptions(selectedTool);
    const currentScopeValid = scopeOptions.some((s) => s.id === selectedScope);
    if (!currentScopeValid && scopeOptions.length > 0) {
      setSelectedScope(scopeOptions[0].id);
    }
  }, [selectedTool, selectedScope]);

  const validation = useMemo(() => validateSkillName(skillName), [skillName]);

  const effectiveSkillName = validation.valid
    ? skillName
    : (validation.suggested ?? slugifySkillName(skillName));

  const installPath = useMemo(
    () =>
      getDisplayPath(
        selectedTool,
        selectedScope,
        selectedOS,
        effectiveSkillName
      ),
    [selectedTool, selectedScope, selectedOS, effectiveSkillName]
  );

  const installCommand = useMemo<GeneratedCommand>(
    () =>
      generateInstallCommand({
        tool: selectedTool,
        scope: selectedScope,
        os: selectedOS,
        skillName: effectiveSkillName,
        skillContent,
        sourceUrl,
        hasBundle,
      }),
    [
      selectedTool,
      selectedScope,
      selectedOS,
      effectiveSkillName,
      skillContent,
      sourceUrl,
      hasBundle,
    ]
  );

  const curlCommand = useMemo<GeneratedCommand | null>(
    () =>
      sourceUrl
        ? generateCurlCommand({
            tool: selectedTool,
            scope: selectedScope,
            os: selectedOS,
            skillName: effectiveSkillName,
            skillContent,
            sourceUrl,
          })
        : null,
    [
      selectedTool,
      selectedScope,
      selectedOS,
      effectiveSkillName,
      skillContent,
      sourceUrl,
    ]
  );

  const githubCLICommand = useMemo<GeneratedCommand | null>(
    () =>
      sourceUrl
        ? generateGitHubCLICommand({
            tool: selectedTool,
            scope: selectedScope,
            os: selectedOS,
            skillName: effectiveSkillName,
            skillContent,
            sourceUrl,
            hasBundle,
          })
        : null,
    [
      selectedTool,
      selectedScope,
      selectedOS,
      effectiveSkillName,
      skillContent,
      sourceUrl,
      hasBundle,
    ]
  );

  const handleCopy = useCallback(async (text: string, type: CopiedState) => {
    await navigator.clipboard.writeText(text);
    setCopiedState(type);
    setTimeout(() => setCopiedState(null), 2000);
  }, []);

  const handleDownloadZip = useCallback(async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/skills/install-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: effectiveSkillName,
          skillContent,
          sourceUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate ZIP");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${effectiveSkillName}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [effectiveSkillName, skillContent, sourceUrl]);

  const scopeOptions = getScopeOptions(selectedTool);

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
              className="mb-1 text-lg tracking-tighter"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Install Skill
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Add{" "}
              <span className="font-medium text-foreground">
                {effectiveSkillName}
              </span>{" "}
              to your development environment
            </DialogDescription>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-6">
              {!validation.valid && (
                <motion.div
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                  initial={{ opacity: 0, height: 0 }}
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-amber-600 dark:text-amber-400">
                      Skill name adjusted
                    </p>
                    <p className="text-muted-foreground">
                      Using{" "}
                      <code className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs">
                        {effectiveSkillName}
                      </code>{" "}
                      instead of{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {skillName}
                      </code>
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="space-y-3">
                <p className="font-medium text-sm">Operating System</p>
                <div className="flex gap-2">
                  {(
                    Object.entries(OS_BUTTONS) as [
                      OSButtonOption,
                      (typeof OS_BUTTONS)[OSButtonOption],
                    ][]
                  ).map(([buttonKey, { label, icon: Icon, os }]) => {
                    const isSelected =
                      buttonKey === "unix"
                        ? selectedOS === "macos" || selectedOS === "linux"
                        : selectedOS === os;
                    return (
                      <button
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-medium text-sm transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted/50"
                        )}
                        key={buttonKey}
                        onClick={() => setSelectedOS(os)}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
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
                        <span className="line-clamp-1 text-muted-foreground text-xs">
                          {tool.description}
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
                <p className="text-muted-foreground text-xs">
                  {
                    scopeOptions.find((s) => s.id === selectedScope)
                      ?.description
                  }
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Install Location</span>
                </div>
                <code className="block break-all rounded-lg bg-background px-3 py-2 font-mono text-muted-foreground text-xs">
                  {installPath.path}
                </code>
                {installPath.expandedNote && (
                  <p className="flex items-start gap-1.5 text-muted-foreground/70 text-xs">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    {installPath.expandedNote}
                  </p>
                )}
              </div>

              <Tabs className="space-y-3" defaultValue="command">
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1 gap-2" value="command">
                    <Terminal className="h-4 w-4" />
                    Copy Command
                  </TabsTrigger>
                  <TabsTrigger className="flex-1 gap-2" value="zip">
                    <Download className="h-4 w-4" />
                    Download ZIP
                  </TabsTrigger>
                  {sourceUrl && (
                    <TabsTrigger className="flex-1 gap-2" value="github">
                      <Github className="h-4 w-4" />
                      GitHub CLI
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent className="space-y-3" value="command">
                  <CommandPanel
                    command={installCommand}
                    copied={copiedState === "command"}
                    curlCommand={curlCommand}
                    curlCopied={copiedState === "curl"}
                    onCopy={(text) => handleCopy(text, "command")}
                    onCopyCurl={(text) => handleCopy(text, "curl")}
                  />
                </TabsContent>

                <TabsContent className="space-y-3" value="zip">
                  <ZipPanel
                    isDownloading={isDownloading}
                    onDownload={handleDownloadZip}
                    skillName={effectiveSkillName}
                  />
                </TabsContent>

                {sourceUrl && githubCLICommand && (
                  <TabsContent className="space-y-3" value="github">
                    <GitHubCLIPanel
                      command={githubCLICommand}
                      copied={copiedState === "github"}
                      onCopy={(text) => handleCopy(text, "github")}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </ScrollArea>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function CommandPanel({
  command,
  copied,
  onCopy,
  curlCommand,
  curlCopied,
  onCopyCurl,
}: {
  command: GeneratedCommand;
  copied: boolean;
  onCopy: (text: string) => void;
  curlCommand: GeneratedCommand | null;
  curlCopied: boolean;
  onCopyCurl: (text: string) => void;
}) {
  return (
    <div className="space-y-3">
      <CommandBlock
        command={command}
        copied={copied}
        onCopy={onCopy}
        title={command.description}
      />

      {curlCommand && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Or download directly with curl:
          </p>
          <CommandBlock
            command={curlCommand}
            copied={curlCopied}
            onCopy={onCopyCurl}
          />
        </div>
      )}
    </div>
  );
}

function CommandBlock({
  command,
  copied,
  onCopy,
  title,
}: {
  command: GeneratedCommand;
  copied: boolean;
  onCopy: (text: string) => void;
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-border border-b bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs",
              command.shellType === "powershell"
                ? "bg-blue-500/10 text-blue-500"
                : "bg-emerald-500/10 text-emerald-500"
            )}
          >
            {command.shellType === "powershell" ? "PowerShell" : "Bash"}
          </span>
          {title && (
            <span className="text-muted-foreground text-xs">{title}</span>
          )}
        </div>
        <Button
          className="gap-1.5"
          onClick={() => onCopy(command.command)}
          size="xs"
          variant={copied ? "default" : "outline"}
        >
          {copied ? (
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
      <ScrollArea className="max-h-48">
        <pre
          className={cn(
            "p-4 font-mono text-xs leading-relaxed",
            command.shellType === "powershell"
              ? "text-blue-200 dark:text-blue-300"
              : "text-emerald-200 dark:text-emerald-300"
          )}
          style={{
            background:
              command.shellType === "powershell"
                ? "linear-gradient(145deg, rgba(59, 130, 246, 0.05) 0%, rgba(30, 41, 59, 0.8) 100%)"
                : "linear-gradient(145deg, rgba(16, 185, 129, 0.05) 0%, rgba(30, 41, 59, 0.8) 100%)",
          }}
        >
          <code className="text-foreground">{command.command}</code>
        </pre>
      </ScrollArea>
      {command.warnings && command.warnings.length > 0 && (
        <div className="border-amber-500/20 border-t bg-amber-500/5 px-4 py-2">
          {command.warnings.map((warning) => (
            <p
              className="flex items-start gap-2 text-amber-600 text-xs dark:text-amber-400"
              key={warning}
            >
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ZipPanel({
  skillName,
  onDownload,
  isDownloading,
}: {
  skillName: string;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/30 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Download className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1 text-center">
        <p className="font-medium">Download as ZIP</p>
        <p className="text-muted-foreground text-sm">
          Download the skill files and extract them to your preferred location
        </p>
      </div>
      <Button
        className="gap-2"
        disabled={isDownloading}
        onClick={onDownload}
        size="lg"
      >
        {isDownloading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
            Preparing...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download {skillName}.zip
          </>
        )}
      </Button>
    </div>
  );
}

function GitHubCLIPanel({
  command,
  copied,
  onCopy,
}: {
  command: GeneratedCommand;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <Github className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium text-sm">GitHub CLI Required</p>
          <p className="text-muted-foreground text-xs">
            This method requires the{" "}
            <a
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              href="https://cli.github.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub CLI (gh)
            </a>{" "}
            to be installed and authenticated.
          </p>
        </div>
      </div>
      <CommandBlock
        command={command}
        copied={copied}
        onCopy={onCopy}
        title={command.description}
      />
    </div>
  );
}
