import type { SkillBundleInfo } from "../lib/github-fetcher";

const GITHUB_URL_PATTERN =
  /github\.com\/([^/]+)\/([^/]+)(?:\/(?:blob|tree)\/([^/]+)\/(.+))?/;
const SKILL_MD_SUFFIX_PATTERN = /\/SKILL\.md$/;

export interface BundleFile {
  name: string;
  path: string;
  type: "file" | "dir";
  downloadUrl?: string;
  size?: number;
}

export interface ResolvedBundle {
  skillMdPath: string;
  skillMdContent: string;
  skillDirPath: string;
  files: BundleFile[];
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  totalSize: number;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  size?: number;
}

function parseGitHubUrl(
  url: string
): { owner: string; repo: string; branch: string; path: string } | null {
  const match = url.match(GITHUB_URL_PATTERN);
  if (!match) {
    return null;
  }

  const [, owner, repo, branch = "main", path = ""] = match;
  return { owner, repo, branch, path };
}

async function fetchGitHubContents(
  owner: string,
  repo: string,
  path: string
): Promise<GitHubContentItem[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as GitHubContentItem[]) : [];
}

async function fetchRawContent(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(rawUrl);

  if (!response.ok) {
    if (branch === "main") {
      return fetchRawContent(owner, repo, "master", path);
    }
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  return response.text();
}

async function fetchDirectoryRecursive(
  owner: string,
  repo: string,
  basePath: string,
  maxDepth = 3,
  currentDepth = 0
): Promise<BundleFile[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const contents = await fetchGitHubContents(owner, repo, basePath);
  const files: BundleFile[] = [];

  for (const item of contents) {
    if (item.type === "file") {
      files.push({
        name: item.name,
        path: item.path,
        type: "file",
        downloadUrl: item.download_url,
        size: item.size,
      });
    } else if (item.type === "dir") {
      files.push({
        name: item.name,
        path: item.path,
        type: "dir",
      });

      const subFiles = await fetchDirectoryRecursive(
        owner,
        repo,
        item.path,
        maxDepth,
        currentDepth + 1
      );
      files.push(...subFiles);
    }
  }

  return files;
}

export async function resolveBundleFromUrl(
  sourceUrl: string
): Promise<ResolvedBundle | null> {
  const parsed = parseGitHubUrl(sourceUrl);
  if (!parsed) {
    return null;
  }

  const { owner, repo, branch, path } = parsed;

  const skillDirPath = path.replace(SKILL_MD_SUFFIX_PATTERN, "");
  const skillMdPath = skillDirPath ? `${skillDirPath}/SKILL.md` : "SKILL.md";

  let skillMdContent: string;
  try {
    skillMdContent = await fetchRawContent(owner, repo, branch, skillMdPath);
  } catch {
    return null;
  }

  const files = await fetchDirectoryRecursive(owner, repo, skillDirPath);

  const dirNames = new Set(
    files.filter((f) => f.type === "dir").map((f) => f.name.toLowerCase())
  );

  const hasScripts = dirNames.has("scripts");
  const hasReferences = dirNames.has("references");
  const hasAssets = dirNames.has("assets");

  const totalSize = files
    .filter((f) => f.type === "file" && f.size)
    .reduce((sum, f) => sum + (f.size ?? 0), 0);

  return {
    skillMdPath,
    skillMdContent,
    skillDirPath,
    files,
    hasScripts,
    hasReferences,
    hasAssets,
    totalSize,
  };
}

export function bundleInfoFromResolved(
  resolved: ResolvedBundle
): SkillBundleInfo | undefined {
  const { hasScripts, hasReferences, hasAssets, files } = resolved;

  const additionalFiles = files
    .filter((f) => f.type === "file" && f.name !== "SKILL.md")
    .map((f) => f.name);

  if (
    !(hasScripts || hasReferences || hasAssets) &&
    additionalFiles.length === 0
  ) {
    return undefined;
  }

  return {
    hasScripts,
    hasReferences,
    hasAssets,
    additionalFiles,
  };
}

export function hasMultiFileBundle(bundleInfo?: SkillBundleInfo): boolean {
  if (!bundleInfo) {
    return false;
  }

  return (
    bundleInfo.hasScripts ||
    bundleInfo.hasReferences ||
    bundleInfo.hasAssets ||
    bundleInfo.additionalFiles.length > 0
  );
}

export function formatBundleSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fetchBundleFiles(
  sourceUrl: string
): Promise<Map<string, string>> {
  const resolved = await resolveBundleFromUrl(sourceUrl);
  if (!resolved) {
    throw new Error("Could not resolve bundle from URL");
  }

  const parsed = parseGitHubUrl(sourceUrl);
  if (!parsed) {
    throw new Error("Invalid GitHub URL");
  }

  const { owner, repo, branch } = parsed;
  const fileContents = new Map<string, string>();

  const relativePath = (fullPath: string) => {
    if (resolved.skillDirPath && fullPath.startsWith(resolved.skillDirPath)) {
      return fullPath.slice(resolved.skillDirPath.length + 1);
    }
    return fullPath;
  };

  fileContents.set("SKILL.md", resolved.skillMdContent);

  const textFileExtensions = [
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".sh",
    ".ps1",
    ".py",
    ".js",
    ".ts",
  ];

  for (const file of resolved.files) {
    if (file.type !== "file" || file.name === "SKILL.md") {
      continue;
    }

    const hasTextExtension = textFileExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (hasTextExtension && file.downloadUrl) {
      const content = await fetchRawContent(
        owner,
        repo,
        branch,
        file.path
      ).catch(() => null);
      if (content) {
        fileContents.set(relativePath(file.path), content);
      }
    }
  }

  return fileContents;
}
