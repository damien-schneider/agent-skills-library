export type AgentTool = "claude" | "codex" | "cursor" | "generic";
export type InstallScope = "project" | "user" | "admin";
export type OperatingSystem = "macos" | "linux" | "windows";

export interface ToolInfo {
  id: AgentTool;
  name: string;
  description: string;
  icon: string;
  docsUrl: string;
  supportedScopes: InstallScope[];
}

export interface ScopeInfo {
  id: InstallScope;
  name: string;
  description: string;
}

export interface PathTemplate {
  unix: string;
  windows: string;
}

const VALID_SKILL_NAME_PATTERN = /^[a-z0-9-]+$/;
const SPACES_PATTERN = /\s+/g;
const INVALID_CHARS_PATTERN = /[^a-z0-9-]/g;
const MULTIPLE_HYPHENS_PATTERN = /-+/g;
const LEADING_TRAILING_HYPHENS_PATTERN = /^-|-$/g;

export const AGENT_TOOLS: Record<AgentTool, ToolInfo> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    description: "Anthropic's Claude Code CLI and IDE extension",
    icon: "🤖",
    docsUrl:
      "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview",
    supportedScopes: ["project", "user"],
  },
  codex: {
    id: "codex",
    name: "OpenAI Codex",
    description: "OpenAI's Codex CLI and IDE extension",
    icon: "⚡",
    docsUrl: "https://developers.openai.com/codex/skills",
    supportedScopes: ["project", "user", "admin"],
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    description: "Cursor AI-powered IDE (uses .cursor/rules/ with .mdc format)",
    icon: "📝",
    docsUrl: "https://docs.cursor.com/context/rules-for-ai",
    supportedScopes: ["project"],
  },
  generic: {
    id: "generic",
    name: "Generic (Agent Skills Spec)",
    description: "Standard Agent Skills format compatible with any tool",
    icon: "📦",
    docsUrl: "https://agentskills.io/specification",
    supportedScopes: ["project", "user"],
  },
};

export const INSTALL_SCOPES: Record<InstallScope, ScopeInfo> = {
  project: {
    id: "project",
    name: "Project",
    description: "Available only in the current project/repository",
  },
  user: {
    id: "user",
    name: "User",
    description: "Available across all projects for the current user",
  },
  admin: {
    id: "admin",
    name: "Admin/System",
    description: "Available to all users on the machine (requires admin)",
  },
};

export const INSTALL_PATHS: Record<
  AgentTool,
  Partial<Record<InstallScope, PathTemplate>>
> = {
  claude: {
    project: {
      unix: ".claude/skills/{skillName}",
      windows: ".claude\\skills\\{skillName}",
    },
    user: {
      unix: "~/.claude/skills/{skillName}",
      windows: "%USERPROFILE%\\.claude\\skills\\{skillName}",
    },
  },
  codex: {
    project: {
      unix: ".codex/skills/{skillName}",
      windows: ".codex\\skills\\{skillName}",
    },
    user: {
      unix: "~/.codex/skills/{skillName}",
      windows: "%USERPROFILE%\\.codex\\skills\\{skillName}",
    },
    admin: {
      unix: "/etc/codex/skills/{skillName}",
      windows: "C:\\ProgramData\\codex\\skills\\{skillName}",
    },
  },
  cursor: {
    project: {
      unix: ".cursor/rules/{skillName}.mdc",
      windows: ".cursor\\rules\\{skillName}.mdc",
    },
  },
  generic: {
    project: {
      unix: ".agent-skills/{skillName}",
      windows: ".agent-skills\\{skillName}",
    },
    user: {
      unix: "~/.agent-skills/{skillName}",
      windows: "%USERPROFILE%\\.agent-skills\\{skillName}",
    },
  },
};

export const CURSOR_CLAUDE_COMPAT_PATHS: Partial<
  Record<InstallScope, PathTemplate>
> = {
  project: {
    unix: ".claude/skills/{skillName}",
    windows: ".claude\\skills\\{skillName}",
  },
  user: {
    unix: "~/.claude/skills/{skillName}",
    windows: "%USERPROFILE%\\.claude\\skills\\{skillName}",
  },
};

export function getInstallPath(
  tool: AgentTool,
  scope: InstallScope,
  os: OperatingSystem,
  skillName: string
): string {
  const pathTemplate = INSTALL_PATHS[tool]?.[scope];
  if (!pathTemplate) {
    throw new Error(`No path template for ${tool}/${scope}`);
  }

  const template = os === "windows" ? pathTemplate.windows : pathTemplate.unix;
  return template.replace("{skillName}", skillName);
}

export function getDisplayPath(
  tool: AgentTool,
  scope: InstallScope,
  os: OperatingSystem,
  skillName: string
): { path: string; expandedNote?: string } {
  const path = getInstallPath(tool, scope, os, skillName);

  if (path.startsWith("~")) {
    return {
      path,
      expandedNote:
        os === "windows"
          ? "~ expands to %USERPROFILE% (typically C:\\Users\\YourName)"
          : "~ expands to $HOME (typically /Users/YourName on macOS, /home/YourName on Linux)",
    };
  }

  if (path.includes("%USERPROFILE%")) {
    return {
      path,
      expandedNote:
        "%USERPROFILE% expands to your user folder (typically C:\\Users\\YourName)",
    };
  }

  return { path };
}

export function validateSkillName(name: string): {
  valid: boolean;
  errors: string[];
  suggested?: string;
} {
  const errors: string[] = [];

  if (!name || name.length === 0) {
    errors.push("Skill name is required");
    return { valid: false, errors };
  }

  if (name.length > 64) {
    errors.push("Skill name must be at most 64 characters");
  }

  if (!VALID_SKILL_NAME_PATTERN.test(name)) {
    errors.push(
      "Skill name must contain only lowercase letters, numbers, and hyphens"
    );
  }

  if (name.startsWith("-") || name.endsWith("-")) {
    errors.push("Skill name cannot start or end with a hyphen");
  }

  if (name.includes("--")) {
    errors.push("Skill name cannot contain consecutive hyphens");
  }

  let suggested: string | undefined;
  if (errors.length > 0) {
    suggested = slugifySkillName(name);
  }

  return {
    valid: errors.length === 0,
    errors,
    suggested,
  };
}

export function slugifySkillName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(SPACES_PATTERN, "-")
    .replace(INVALID_CHARS_PATTERN, "")
    .replace(MULTIPLE_HYPHENS_PATTERN, "-")
    .replace(LEADING_TRAILING_HYPHENS_PATTERN, "")
    .slice(0, 64);
}

export function detectOS(): OperatingSystem {
  if (typeof window === "undefined") {
    return "macos";
  }

  const platform = navigator.platform?.toLowerCase() ?? "";
  const userAgent = navigator.userAgent?.toLowerCase() ?? "";

  if (platform.includes("win") || userAgent.includes("windows")) {
    return "windows";
  }
  if (platform.includes("linux") || userAgent.includes("linux")) {
    return "linux";
  }
  return "macos";
}

export function getToolOptions(): ToolInfo[] {
  return Object.values(AGENT_TOOLS);
}

export function getScopeOptions(tool: AgentTool): ScopeInfo[] {
  const supportedScopes = AGENT_TOOLS[tool].supportedScopes;
  return supportedScopes.map((scope) => INSTALL_SCOPES[scope]);
}
