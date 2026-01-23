import type {
  Doc,
  Id,
} from "@skills-agent-library/backend/convex/_generated/dataModel";

export type Skill = Omit<Doc<"skills">, "upvotes" | "downvotes"> & {
  votes: number;
  upvotes: number;
  downvotes: number;
  userVote?: "up" | "down" | null;
  installCount?: number;
  weeklyInstalls?: number;
  githubOwner?: string;
  githubRepo?: string;
  skillSlug?: string;
  isOfficialSource?: boolean;
  githubStarsCached?: number;
};

export type Category = Doc<"categories">;
export type OfficialRepo = Doc<"officialRepos">;
export type SkillInstall = Doc<"skillInstalls">;
export type SkillInstallStat = Doc<"skillInstallStats">;

export type SkillId = Id<"skills">;
export type CategoryId = Id<"categories">;
export type OfficialRepoId = Id<"officialRepos">;

export type AgentPlatform =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "opencode"
  | "gemini-cli"
  | "antigravity"
  | "codex"
  | "github-copilot"
  | "amp"
  | "goose"
  | "kilo"
  | "kiro-cli"
  | "roo"
  | "trae"
  | "clawdbot"
  | "droid"
  | "unknown";

export const agentPlatformLabels: Record<AgentPlatform, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  windsurf: "Windsurf",
  opencode: "OpenCode",
  "gemini-cli": "Gemini CLI",
  antigravity: "Antigravity",
  codex: "Codex",
  "github-copilot": "GitHub Copilot",
  amp: "AMP",
  goose: "Goose",
  kilo: "Kilo",
  "kiro-cli": "Kiro CLI",
  roo: "Roo",
  trae: "Trae",
  clawdbot: "ClawdBot",
  droid: "Droid",
  unknown: "Unknown",
};

export interface SkillInstallStats {
  totalInstalls: number;
  last24h: number;
  last7d: number;
  byAgent: Record<AgentPlatform, number>;
}

export interface SkillWithTrending extends Skill {
  trendingInstalls?: number;
}

export interface SkillNamespace {
  owner: string;
  repo: string;
  skill: string;
}

export interface AIScore {
  overall: number;
  clarity: number;
  usefulness: number;
  completeness: number;
}

export const skillColors = [
  "oklch(0.92 0.08 100)",
  "oklch(0.90 0.10 145)",
  "oklch(0.90 0.08 300)",
  "oklch(0.92 0.10 30)",
  "oklch(0.88 0.10 220)",
  "oklch(0.90 0.08 180)",
] as const;

export function getRandomSkillColor(): string {
  return skillColors[Math.floor(Math.random() * skillColors.length)];
}

export interface CustomMetadataField {
  key: string;
  value: string;
}

export interface SkillFormData {
  name: string;
  description: string;
  tags: string[];
  content: string;
  license: string;
  compatibility: string;
  allowedTools: string;
  customMetadata: CustomMetadataField[];
}

export interface SkillSection {
  id: string;
  title: string;
  content: string;
  type: "text" | "code" | "list";
}

export const initialFormData: SkillFormData = {
  name: "",
  description: "",
  tags: [],
  content: "",
  license: "",
  compatibility: "",
  allowedTools: "",
  customMetadata: [],
};

const LEADING_SLASH_REGEX = /^\//;

export function parseSkillNamespace(path: string): SkillNamespace | null {
  const parts = path
    .replace(LEADING_SLASH_REGEX, "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  return {
    owner: parts[0],
    repo: parts[1],
    skill: parts[2],
  };
}

export function getSkillNamespacePath(skill: {
  githubOwner?: string;
  githubRepo?: string;
  skillSlug?: string;
}): string | null {
  if (!(skill.githubOwner && skill.githubRepo && skill.skillSlug)) {
    return null;
  }
  return `/${skill.githubOwner}/${skill.githubRepo}/${skill.skillSlug}`;
}

export function getSkillInstallCommand(skill: {
  githubOwner?: string;
  githubRepo?: string;
  skillSlug?: string;
}): string | null {
  if (!(skill.githubOwner && skill.githubRepo && skill.skillSlug)) {
    return null;
  }
  return `npx skills add https://github.com/${skill.githubOwner}/${skill.githubRepo} --skill ${skill.skillSlug}`;
}

export function getGithubRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

export function formatInstallCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Generate the URL path for a skill.
 * Uses slug-based URL (/skills/[owner]/[slug]) when GitHub namespace is available,
 * otherwise falls back to ID-based URL (/skills/[id]).
 */
export function getSkillUrl(skill: {
  _id: string;
  githubOwner?: string;
  skillSlug?: string;
}): string {
  if (skill.githubOwner && skill.skillSlug) {
    return `/skills/${skill.githubOwner}/${skill.skillSlug}`;
  }
  return `/skills/${skill._id}`;
}
