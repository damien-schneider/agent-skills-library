/**
 * GitHub URL Parser and Content Fetcher
 *
 * Handles:
 * 1. Direct SKILL.md file URLs
 * 2. Directory URLs (skill folders containing SKILL.md)
 * 3. Repository URLs (fetches all SKILL.md files recursively)
 *
 * Supports skill bundles per Agent Skills spec:
 * - skill-name/
 *   ├── SKILL.md (required)
 *   ├── scripts/ (optional)
 *   ├── references/ (optional)
 *   └── assets/ (optional)
 */

import {
  type ParsedSkill,
  parseSkillMarkdown,
  type ValidationResult,
  validateParsedSkill,
} from "./skill-parser";

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  url: string;
}

interface ParsedGitHubUrl {
  type: "file" | "repo" | "directory";
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

/** Skill bundle detection info */
export interface SkillBundleInfo {
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  additionalFiles: string[];
}

export interface FetchedSkill extends ParsedSkill {
  sourceUrl: string;
  sourcePath?: string;
  bundle?: SkillBundleInfo;
  validation?: ValidationResult;
  githubOwner?: string;
  githubRepo?: string;
  skillSlug?: string;
}

function deriveSkillSlug(
  sourcePath: string | undefined,
  skillName: string
): string {
  if (sourcePath) {
    const parts = sourcePath.split("/");
    if (parts.length >= 2) {
      const parentDir = parts.at(-2);
      if (
        parentDir &&
        parentDir !== "." &&
        parentDir.toLowerCase() !== "skills"
      ) {
        return parentDir.toLowerCase().replace(/\s+/g, "-");
      }
    }
  }
  return skillName.toLowerCase().replace(/\s+/g, "-");
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname !== "github.com") {
      return null;
    }

    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1];

    // Root repo URL: github.com/owner/repo
    if (pathParts.length === 2) {
      return { type: "repo", owner, repo };
    }

    // File or directory URL: github.com/owner/repo/blob/branch/path
    if (pathParts[2] === "blob" && pathParts.length >= 4) {
      const branch = pathParts[3];
      const path = pathParts.slice(4).join("/");
      return { type: "file", owner, repo, branch, path };
    }

    // Tree URL (directory): github.com/owner/repo/tree/branch/path
    if (pathParts[2] === "tree" && pathParts.length >= 4) {
      const branch = pathParts[3];
      const path = pathParts.slice(4).join("/");
      return { type: "directory", owner, repo, branch, path };
    }

    // Just owner/repo with extra parts - treat as repo
    return { type: "repo", owner, repo };
  } catch {
    return null;
  }
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch = "main"
): Promise<string> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(rawUrl);

  if (!response.ok) {
    // Try 'master' branch as fallback
    if (branch === "main") {
      return fetchFileContent(owner, repo, path, "master");
    }
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  return response.text();
}

async function fetchDirectoryContents(
  owner: string,
  repo: string,
  path = ""
): Promise<GitHubFile[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch directory: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

async function findSkillFiles(
  owner: string,
  repo: string,
  basePath = "",
  maxDepth = 4
): Promise<{ path: string; dirContents?: GitHubFile[] }[]> {
  const skillFiles: { path: string; dirContents?: GitHubFile[] }[] = [];

  async function searchDirectory(path: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    try {
      const contents = await fetchDirectoryContents(owner, repo, path);

      // Check if this directory contains a SKILL.md
      const skillFile = contents.find(
        (item) => item.type === "file" && item.name === "SKILL.md"
      );
      if (skillFile) {
        skillFiles.push({
          path: skillFile.path,
          dirContents: contents, // Store sibling files for bundle detection
        });
      }

      // Continue searching subdirectories
      for (const item of contents) {
        if (
          item.type === "dir" &&
          !item.name.startsWith(".") &&
          item.name !== "node_modules"
        ) {
          await searchDirectory(item.path, depth + 1);
        }
      }
    } catch (error) {
      // Skip directories we can't access
      console.warn(`Could not access ${path}:`, error);
    }
  }

  await searchDirectory(basePath, 0);
  return skillFiles;
}

/** Detect skill bundle structure from directory contents */
function detectSkillBundle(
  dirContents?: GitHubFile[]
): SkillBundleInfo | undefined {
  if (!dirContents) {
    return undefined;
  }

  const dirNames = dirContents
    .filter((f) => f.type === "dir")
    .map((f) => f.name.toLowerCase());
  const fileNames = dirContents
    .filter((f) => f.type === "file" && f.name !== "SKILL.md")
    .map((f) => f.name);

  const hasScripts = dirNames.includes("scripts");
  const hasReferences = dirNames.includes("references");
  const hasAssets = dirNames.includes("assets");

  // Only return bundle info if there's something beyond just SKILL.md
  if (!(hasScripts || hasReferences || hasAssets) && fileNames.length === 0) {
    return undefined;
  }

  return {
    hasScripts,
    hasReferences,
    hasAssets,
    additionalFiles: fileNames,
  };
}

export async function fetchSkillFromUrl(url: string): Promise<FetchedSkill> {
  const parsed = parseGitHubUrl(url);

  if (!parsed) {
    throw new Error("Invalid GitHub URL");
  }

  // Handle direct file URLs
  if (parsed.type === "file" && parsed.path) {
    const content = await fetchFileContent(
      parsed.owner,
      parsed.repo,
      parsed.path,
      parsed.branch
    );

    const skill = parseSkillMarkdown(content);
    const validation = validateParsedSkill(skill, { sourcePath: parsed.path });

    return {
      ...skill,
      sourceUrl: url,
      sourcePath: parsed.path,
      validation,
      githubOwner: parsed.owner,
      githubRepo: parsed.repo,
      skillSlug: deriveSkillSlug(parsed.path, skill.name),
    };
  }

  // Handle directory URLs - try to find SKILL.md and detect bundle
  if (parsed.type === "directory" && parsed.path) {
    const skillPath = `${parsed.path}/SKILL.md`;
    const branch = parsed.branch || "main";

    try {
      // Fetch the SKILL.md content
      const content = await fetchFileContent(
        parsed.owner,
        parsed.repo,
        skillPath,
        branch
      );

      // Also fetch directory contents for bundle detection
      let bundle: SkillBundleInfo | undefined;
      try {
        const dirContents = await fetchDirectoryContents(
          parsed.owner,
          parsed.repo,
          parsed.path
        );
        bundle = detectSkillBundle(dirContents);
      } catch {
        // Bundle detection is optional
      }

      const skill = parseSkillMarkdown(content);
      const validation = validateParsedSkill(skill, { sourcePath: skillPath });

      return {
        ...skill,
        sourceUrl: `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/${skillPath}`,
        sourcePath: skillPath,
        bundle,
        validation,
        githubOwner: parsed.owner,
        githubRepo: parsed.repo,
        skillSlug: deriveSkillSlug(skillPath, skill.name),
      };
    } catch {
      // If direct SKILL.md fetch fails, search subdirectories
      const skillFiles = await findSkillFiles(
        parsed.owner,
        parsed.repo,
        parsed.path,
        2
      );

      if (skillFiles.length === 0) {
        throw new Error(
          `No SKILL.md found in directory. Try using "Import from Repo" for repository-wide import.`
        );
      }

      // Return the first found skill
      const firstSkill = skillFiles[0];
      const skillContent = await fetchFileContent(
        parsed.owner,
        parsed.repo,
        firstSkill.path,
        branch
      );

      const skill = parseSkillMarkdown(skillContent);
      const bundle = detectSkillBundle(firstSkill.dirContents);
      const validation = validateParsedSkill(skill, {
        sourcePath: firstSkill.path,
      });

      return {
        ...skill,
        sourceUrl: `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/${firstSkill.path}`,
        sourcePath: firstSkill.path,
        bundle,
        validation,
        githubOwner: parsed.owner,
        githubRepo: parsed.repo,
        skillSlug: deriveSkillSlug(firstSkill.path, skill.name),
      };
    }
  }

  throw new Error("URL must point to a specific file or directory");
}

export async function fetchAllSkillsFromRepo(
  url: string,
  onProgress?: (message: string) => void
): Promise<FetchedSkill[]> {
  const parsed = parseGitHubUrl(url);

  if (!parsed) {
    throw new Error("Invalid GitHub URL");
  }

  // For directory URLs, use the directory path directly as the base
  // For file URLs pointing to a SKILL.md, get the parent directory
  // For repo URLs, search from root
  let basePath = "";
  if (parsed.type === "directory" && parsed.path) {
    basePath = parsed.path;
  } else if (parsed.type === "file" && parsed.path) {
    basePath = parsed.path.split("/").slice(0, -1).join("/");
  }

  onProgress?.(
    `Searching for SKILL.md files in ${parsed.owner}/${parsed.repo}${basePath ? `/${basePath}` : ""}...`
  );

  const skillFiles = await findSkillFiles(parsed.owner, parsed.repo, basePath);

  if (skillFiles.length === 0) {
    throw new Error("No SKILL.md files found in repository");
  }

  onProgress?.(`Found ${skillFiles.length} skill file(s). Fetching content...`);

  const skills: FetchedSkill[] = [];
  const branch = parsed.branch || "main";

  for (let i = 0; i < skillFiles.length; i++) {
    const { path: filePath, dirContents } = skillFiles[i];
    onProgress?.(`Fetching ${i + 1}/${skillFiles.length}: ${filePath}`);

    try {
      const content = await fetchFileContent(
        parsed.owner,
        parsed.repo,
        filePath,
        branch
      );
      const skill = parseSkillMarkdown(content);
      const bundle = detectSkillBundle(dirContents);
      const validation = validateParsedSkill(skill, { sourcePath: filePath });

      skills.push({
        ...skill,
        sourceUrl: `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/${filePath}`,
        sourcePath: filePath,
        bundle,
        validation,
        githubOwner: parsed.owner,
        githubRepo: parsed.repo,
        skillSlug: deriveSkillSlug(filePath, skill.name),
      });
    } catch (error) {
      console.warn(`Failed to fetch ${filePath}:`, error);
    }
  }

  return skills;
}

export function isDirectFileUrl(url: string): boolean {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return false;
  }

  // Direct file link to a markdown file
  if (parsed.type === "file") {
    return (
      (parsed.path?.endsWith(".md") || parsed.path?.endsWith("SKILL.md")) ===
      true
    );
  }

  // Directory URL (likely containing a SKILL.md) - also treat as single import
  if (parsed.type === "directory" && parsed.path) {
    return true;
  }

  return false;
}

export function isRepoUrl(url: string): boolean {
  const parsed = parseGitHubUrl(url);
  return parsed?.type === "repo";
}
