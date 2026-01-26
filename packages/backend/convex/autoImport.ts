import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  url: string;
}

interface ParsedSkill {
  name: string;
  description: string;
  markdown: string;
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
    license?: string;
    compatibility?: string;
    allowedTools?: string[];
    shortDescription?: string;
  };
}

interface FetchedSkill extends ParsedSkill {
  sourceUrl: string;
  sourcePath: string;
  githubOwner: string;
  githubRepo: string;
  skillSlug: string;
}

interface ImportResult {
  name: string;
  status: "imported" | "skipped" | "error" | "updated";
  reason?: string;
  skillId?: string;
  sourcePath?: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;
const BOTTOM_FRONTMATTER_REGEX = /\n---\s*\n([\s\S]*?)\n---\s*$/;
const TITLE_REGEX = /^#\s+(.+)$/m;
const KEY_VALUE_REGEX = /^(\w[\w-]*):\s*(.*)$/;
const ARRAY_VALUE_REGEX = /^\[.*\]$/;
const GITHUB_URL_REGEX =
  /github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/[^/]+\/(.+))?/;
const WHITESPACE_REGEX = /\s+/;

const RATE_LIMIT_DELAY_MS = 100;
const MAX_CONCURRENT_REQUESTS = 5;
const MAX_SKILL_FILES_PER_REPO = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number,
  delayMs: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await delay(delayMs);
    }
  }

  return results;
}

interface FrontmatterData {
  name?: string;
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
  license?: string;
  compatibility?: string;
  "allowed-tools"?: string;
  "short-description"?: string;
  [key: string]: unknown;
}

function parseFrontmatter(content: string): FrontmatterData {
  const result: FrontmatterData = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(" ") || trimmed.startsWith("\t")) {
      continue;
    }

    const match = trimmed.match(KEY_VALUE_REGEX);
    if (match) {
      const [, key, rawValue] = match;
      if (!key || rawValue === undefined) {
        continue;
      }
      const value = rawValue.replace(/^["']|["']$/g, "").trim();

      if (ARRAY_VALUE_REGEX.test(value)) {
        const items = value
          .slice(1, -1)
          .split(",")
          .map((item) =>
            item
              .trim()
              .replace(/^["']|["']$/g, "")
              .trim()
          )
          .filter(Boolean);
        if (key === "tags") {
          result.tags = items;
        }
        continue;
      }

      switch (key) {
        case "name":
          result.name = value;
          break;
        case "description":
          result.description = value;
          break;
        case "author":
          result.author = value;
          break;
        case "version":
          result.version = value;
          break;
        case "license":
          result.license = value;
          break;
        case "compatibility":
          result.compatibility = value;
          break;
        case "allowed-tools":
          result["allowed-tools"] = value;
          break;
        case "short-description":
          result["short-description"] = value;
          break;
        default:
          result[key] = value;
      }
    }
  }

  return result;
}

function extractDescriptionFromMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  let foundTitle = false;
  const descriptionParts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && trimmed && !trimmed.startsWith("#")) {
      descriptionParts.push(trimmed);
      const combined = descriptionParts.join(" ");
      if (combined.length >= 10) {
        return combined.length > 500
          ? `${combined.slice(0, 497)}...`
          : combined;
      }
    }
  }

  if (descriptionParts.length > 0) {
    const combined = descriptionParts.join(" ");
    return combined.length > 500 ? `${combined.slice(0, 497)}...` : combined;
  }

  return "No description provided";
}

function parseSkillMarkdown(content: string): ParsedSkill {
  let frontmatter: FrontmatterData = {};
  let cleanedMarkdown = content.trim();

  const topMatch = content.match(FRONTMATTER_REGEX);
  if (topMatch?.[1]) {
    frontmatter = parseFrontmatter(topMatch[1]);
    cleanedMarkdown = content.slice(topMatch[0].length).trim();
  }

  const bottomMatch = content.match(BOTTOM_FRONTMATTER_REGEX);
  if (bottomMatch?.[1]) {
    const bottomFrontmatter = parseFrontmatter(bottomMatch[1]);
    frontmatter = { ...frontmatter, ...bottomFrontmatter };
    cleanedMarkdown = content.slice(0, bottomMatch.index ?? 0).trim();

    const topInCleaned = cleanedMarkdown.match(FRONTMATTER_REGEX);
    if (topInCleaned) {
      cleanedMarkdown = cleanedMarkdown.slice(topInCleaned[0].length).trim();
    }
  }

  const titleMatch = cleanedMarkdown.match(TITLE_REGEX);
  const name = frontmatter.name || titleMatch?.[1]?.trim() || "Untitled Skill";

  const description =
    frontmatter.description || extractDescriptionFromMarkdown(cleanedMarkdown);

  const allowedToolsRaw = frontmatter["allowed-tools"];
  const allowedTools = allowedToolsRaw
    ? allowedToolsRaw.split(WHITESPACE_REGEX).filter(Boolean)
    : undefined;

  return {
    name,
    description,
    markdown: cleanedMarkdown,
    metadata: {
      author: frontmatter.author,
      version: frontmatter.version,
      tags: frontmatter.tags,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
      allowedTools,
      shortDescription: frontmatter["short-description"],
    },
  };
}

function deriveSkillSlug(sourcePath: string, skillName: string): string {
  const parts = sourcePath.split("/");
  if (parts.length >= 2) {
    const parentDir = parts[parts.length - 2];
    if (
      parentDir &&
      parentDir !== "." &&
      parentDir.toLowerCase() !== "skills"
    ) {
      return parentDir.toLowerCase().replace(/\s+/g, "-");
    }
  }
  return skillName.toLowerCase().replace(/\s+/g, "-");
}

async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  branch = "main"
): Promise<string> {
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const response = await fetch(rawUrl);

  if (!response.ok) {
    if (branch === "main") {
      return fetchGitHubFile(owner, repo, path, "master");
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
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "skills-agent-library",
    },
  });

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
    if (rateLimitRemaining === "0") {
      const resetTime = response.headers.get("X-RateLimit-Reset");
      const resetDate = resetTime
        ? new Date(Number.parseInt(resetTime, 10) * 1000)
        : null;
      throw new Error(
        `GitHub rate limit exceeded. Resets at ${resetDate?.toISOString() ?? "unknown"}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch directory: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    return [data as GitHubFile];
  }
  return data as GitHubFile[];
}

async function findSkillFiles(
  owner: string,
  repo: string,
  basePath = "",
  maxDepth = 4
): Promise<{ path: string }[]> {
  const skillFiles: { path: string }[] = [];
  let apiCallCount = 0;

  async function searchDirectory(path: string, depth: number): Promise<void> {
    if (depth > maxDepth || skillFiles.length >= MAX_SKILL_FILES_PER_REPO) {
      return;
    }

    try {
      if (apiCallCount > 0) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
      apiCallCount++;

      const contents = await fetchDirectoryContents(owner, repo, path);

      const skillFile = contents.find(
        (item) => item.type === "file" && item.name === "SKILL.md"
      );
      if (skillFile) {
        skillFiles.push({ path: skillFile.path });
      }

      const directories = contents.filter(
        (item) =>
          item.type === "dir" &&
          !item.name.startsWith(".") &&
          item.name !== "node_modules"
      );

      for (const item of directories) {
        if (skillFiles.length >= MAX_SKILL_FILES_PER_REPO) {
          break;
        }
        await searchDirectory(item.path, depth + 1);
      }
    } catch (error) {
      console.warn(`Could not access ${path}:`, error);
    }
  }

  await searchDirectory(basePath, 0);
  return skillFiles;
}

async function fetchAllSkillsFromRepo(
  owner: string,
  repo: string
): Promise<FetchedSkill[]> {
  const skillFiles = await findSkillFiles(owner, repo);

  if (skillFiles.length === 0) {
    return [];
  }

  const fetchSkillContent = async (file: {
    path: string;
  }): Promise<FetchedSkill | null> => {
    try {
      const content = await fetchGitHubFile(owner, repo, file.path);
      const parsed = parseSkillMarkdown(content);
      const skillSlug = deriveSkillSlug(file.path, parsed.name);

      return {
        ...parsed,
        sourceUrl: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
        sourcePath: file.path,
        githubOwner: owner,
        githubRepo: repo,
        skillSlug,
      };
    } catch (error) {
      console.warn(`Failed to fetch ${file.path}:`, error);
      return null;
    }
  };

  const results = await processBatch(
    skillFiles,
    fetchSkillContent,
    MAX_CONCURRENT_REQUESTS,
    RATE_LIMIT_DELAY_MS
  );

  return results.filter((skill): skill is FetchedSkill => skill !== null);
}

export const checkSkillExists = query({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
    skillSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_github_namespace", (q) =>
        q
          .eq("githubOwner", args.githubOwner)
          .eq("githubRepo", args.githubRepo)
          .eq("skillSlug", args.skillSlug)
      )
      .first();
    return existing !== null;
  },
});

export const createImportedSkill = internalMutation({
  args: {
    name: v.string(),
    description: v.string(),
    markdown: v.string(),
    authorName: v.string(),
    tags: v.array(v.string()),
    sourceUrl: v.string(),
    sourcePath: v.string(),
    githubOwner: v.string(),
    githubRepo: v.string(),
    skillSlug: v.string(),
    isOfficialSource: v.boolean(),
    officialRepoId: v.optional(v.id("officialRepos")),
    version: v.optional(v.string()),
    license: v.optional(v.string()),
    compatibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_github_namespace", (q) =>
        q
          .eq("githubOwner", args.githubOwner)
          .eq("githubRepo", args.githubRepo)
          .eq("skillSlug", args.skillSlug)
      )
      .first();

    const normalizedName = normalizeSkillName(args.name);
    const normalizedDescription = normalizeDescription(
      args.description,
      args.markdown,
      normalizedName
    );
    const normalizedMarkdown = normalizeMarkdown(args.markdown, normalizedName);

    if (normalizedMarkdown.length < 50) {
      return {
        status: "skipped" as const,
        reason: "Markdown content too short (min 50 chars)",
      };
    }

    const normalizedTags = args.tags
      .slice(0, 10)
      .map((t) => t.trim().toLowerCase().slice(0, 30))
      .filter(Boolean);

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: normalizedName,
        description: normalizedDescription,
        markdown: normalizedMarkdown,
        authorName: args.authorName.trim() || args.githubOwner,
        tags: normalizedTags,
        sourceUrl: args.sourceUrl,
        sourcePath: args.sourcePath,
        isOfficialSource: args.isOfficialSource,
        officialRepoId: args.officialRepoId,
        version: args.version,
        license: args.license,
        compatibility: args.compatibility,
      });
      return { status: "updated" as const, skillId: existing._id.toString() };
    }

    const colors = [
      "oklch(0.92 0.08 100)",
      "oklch(0.90 0.10 145)",
      "oklch(0.90 0.08 300)",
      "oklch(0.92 0.10 30)",
      "oklch(0.88 0.10 220)",
      "oklch(0.90 0.08 180)",
    ];
    const colorIndex =
      normalizedName
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const color = colors[colorIndex] as string;

    const skillId = await ctx.db.insert("skills", {
      name: normalizedName,
      description: normalizedDescription,
      markdown: normalizedMarkdown,
      category: "uncategorized",
      authorId: "import",
      authorName: args.authorName.trim() || args.githubOwner,
      tags: normalizedTags,
      color,
      score: 0,
      upvotes: 0,
      downvotes: 0,
      sourceUrl: args.sourceUrl,
      sourcePath: args.sourcePath,
      githubOwner: args.githubOwner,
      githubRepo: args.githubRepo,
      skillSlug: args.skillSlug,
      isOfficialSource: args.isOfficialSource,
      officialRepoId: args.officialRepoId,
      version: args.version,
      license: args.license,
      compatibility: args.compatibility,
      installCount: 0,
      weeklyInstalls: 0,
    });

    return { status: "imported" as const, skillId: skillId.toString() };
  },
});

function normalizeSkillName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return `${trimmed} Skill`.slice(0, 100);
  }
  return trimmed.slice(0, 100);
}

function normalizeDescription(
  description: string,
  markdown: string,
  skillName: string
): string {
  let desc = description.trim();

  if (desc.length < 10) {
    const lines = markdown.split("\n").filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && !t.startsWith("```");
    });
    desc = lines.slice(0, 3).join(" ").trim();
  }

  if (desc.length < 10) {
    desc = `A skill for ${skillName}. Import from GitHub.`;
  }

  return desc.length > 500 ? `${desc.slice(0, 497)}...` : desc;
}

function normalizeMarkdown(markdown: string, skillName: string): string {
  const trimmed = markdown.trim();
  if (trimmed.length >= 50) {
    return trimmed;
  }

  const padding = `\n\n<!-- Imported skill: ${skillName} -->\n\nThis skill was automatically imported from GitHub.`;
  return trimmed + padding;
}

export const updateOfficialRepoStats = mutation({
  args: { id: v.id("officialRepos") },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_official_repo", (q) => q.eq("officialRepoId", args.id))
      .collect();

    const totalInstalls = skills.reduce(
      (sum, skill) => sum + (skill.installCount ?? 0),
      0
    );

    await ctx.db.patch(args.id, {
      skillCount: skills.length,
      totalInstalls,
    });
  },
});

export const importFromGitHubRepo = action({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
    isOfficialSource: v.optional(v.boolean()),
    officialRepoId: v.optional(v.id("officialRepos")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    results: ImportResult[];
    summary: {
      imported: number;
      skipped: number;
      errors: number;
      updated: number;
    };
  }> => {
    const results: ImportResult[] = [];

    try {
      const skills = await fetchAllSkillsFromRepo(
        args.githubOwner,
        args.githubRepo
      );

      if (skills.length === 0) {
        return {
          results: [
            {
              name: "Repository",
              status: "error",
              reason: "No SKILL.md files found",
            },
          ],
          summary: { imported: 0, skipped: 0, errors: 1, updated: 0 },
        };
      }

      for (const skill of skills) {
        try {
          const result = await ctx.runMutation(
            internal.autoImport.createImportedSkill,
            {
              name: skill.name,
              description: skill.description,
              markdown: skill.markdown,
              authorName: skill.metadata?.author || args.githubOwner,
              tags: skill.metadata?.tags || [],
              sourceUrl: skill.sourceUrl,
              sourcePath: skill.sourcePath,
              githubOwner: skill.githubOwner,
              githubRepo: skill.githubRepo,
              skillSlug: skill.skillSlug,
              isOfficialSource: args.isOfficialSource ?? false,
              officialRepoId: args.officialRepoId,
              version: skill.metadata?.version,
              license: skill.metadata?.license,
              compatibility: skill.metadata?.compatibility,
            }
          );

          results.push({
            name: skill.name,
            status: result.status,
            reason: result.status === "skipped" ? result.reason : undefined,
            skillId: result.skillId,
          });
        } catch (error) {
          results.push({
            name: skill.name,
            status: "error",
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      if (args.officialRepoId) {
        await ctx.runMutation(api.autoImport.updateOfficialRepoStats, {
          id: args.officialRepoId,
        });
      }
    } catch (error) {
      results.push({
        name: "Repository",
        status: "error",
        reason:
          error instanceof Error ? error.message : "Failed to fetch repository",
      });
    }

    const summary = {
      imported: results.filter((r) => r.status === "imported").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      updated: results.filter((r) => r.status === "updated").length,
    };

    return { results, summary };
  },
});

export const syncAllReferenceRepos = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    repoResults: Array<{
      owner: string;
      repo: string;
      results: ImportResult[];
      summary: {
        imported: number;
        skipped: number;
        errors: number;
        updated: number;
      };
    }>;
    totalSummary: {
      imported: number;
      skipped: number;
      errors: number;
      updated: number;
    };
    installCountsUpdated: number;
  }> => {
    const officialRepos = await ctx.runQuery(api.officialRepos.list, {});

    const repoResults: Array<{
      owner: string;
      repo: string;
      results: ImportResult[];
      summary: {
        imported: number;
        skipped: number;
        errors: number;
        updated: number;
      };
    }> = [];

    let totalInstallCountsUpdated = 0;

    for (const repo of officialRepos) {
      const { results, summary } = await ctx.runAction(
        api.autoImport.importFromGitHubRepo,
        {
          githubOwner: repo.githubOwner,
          githubRepo: repo.githubRepo,
          isOfficialSource: true,
          officialRepoId: repo._id,
        }
      );

      const installResult = await ctx.runAction(
        api.autoImport.fetchRepoInstallCounts,
        {
          githubOwner: repo.githubOwner,
          githubRepo: repo.githubRepo,
        }
      );

      totalInstallCountsUpdated += installResult.updated;

      repoResults.push({
        owner: repo.githubOwner,
        repo: repo.githubRepo,
        results,
        summary: { ...summary, updated: summary.updated ?? 0 },
      });
    }

    const totalSummary = {
      imported: repoResults.reduce((sum, r) => sum + r.summary.imported, 0),
      skipped: repoResults.reduce((sum, r) => sum + r.summary.skipped, 0),
      errors: repoResults.reduce((sum, r) => sum + r.summary.errors, 0),
      updated: repoResults.reduce((sum, r) => sum + r.summary.updated, 0),
    };

    return {
      repoResults,
      totalSummary,
      installCountsUpdated: totalInstallCountsUpdated,
    };
  },
});

export const syncOfficialRepo = action({
  args: {
    repoId: v.id("officialRepos"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    results: ImportResult[];
    summary: {
      imported: number;
      skipped: number;
      errors: number;
      updated: number;
    };
  }> => {
    const repo = await ctx.runQuery(api.officialRepos.getById, {
      id: args.repoId,
    });

    if (!repo) {
      return {
        results: [
          {
            name: "Repository",
            status: "error",
            reason: "Repository not found",
          },
        ],
        summary: { imported: 0, skipped: 0, errors: 1, updated: 0 },
      };
    }

    return ctx.runAction(api.autoImport.importFromGitHubRepo, {
      githubOwner: repo.githubOwner,
      githubRepo: repo.githubRepo,
      isOfficialSource: true,
      officialRepoId: repo._id,
    });
  },
});

export const importFromUrl = action({
  args: {
    url: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    results: ImportResult[];
    summary: { imported: number; skipped: number; errors: number };
  }> => {
    const urlMatch = args.url.match(GITHUB_URL_REGEX);

    if (!urlMatch) {
      return {
        results: [
          { name: "URL", status: "error", reason: "Invalid GitHub URL" },
        ],
        summary: { imported: 0, skipped: 0, errors: 1 },
      };
    }

    const [, owner, repo] = urlMatch;

    if (!(owner && repo)) {
      return {
        results: [
          {
            name: "URL",
            status: "error",
            reason: "Could not parse owner/repo from URL",
          },
        ],
        summary: { imported: 0, skipped: 0, errors: 1 },
      };
    }

    const officialRepo = await ctx.runQuery(api.officialRepos.getByNamespace, {
      githubOwner: owner,
      githubRepo: repo,
    });

    return ctx.runAction(api.autoImport.importFromGitHubRepo, {
      githubOwner: owner,
      githubRepo: repo,
      isOfficialSource: officialRepo !== null,
      officialRepoId: officialRepo?._id,
    });
  },
});

interface SkillsShSkill {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

interface SkillsShApiResponse {
  skills: SkillsShSkill[];
  hasMore: boolean;
}

interface SkillsShImportResult extends ImportResult {
  installCount?: number;
}

interface RepoToImport {
  owner: string;
  repo: string;
  skills: SkillsShSkill[];
}

async function fetchSkillsShPage(
  page: number
): Promise<{ data: SkillsShApiResponse | null; error?: string }> {
  try {
    const response = await fetch(`https://skills.sh/api/skills?page=${page}`);
    if (!response.ok) {
      return { data: null, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as SkillsShApiResponse;
    return { data };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function collectReposFromSkills(
  skills: SkillsShSkill[],
  reposMap: Map<string, RepoToImport>
): void {
  for (const skill of skills) {
    if (!skill.topSource) {
      continue;
    }

    const [owner, repo] = skill.topSource.split("/");
    if (!(owner && repo)) {
      continue;
    }

    const key = `${owner}/${repo}`;
    if (!reposMap.has(key)) {
      reposMap.set(key, { owner, repo, skills: [] });
    }
    reposMap.get(key)?.skills.push(skill);
  }
}

export const updateSkillInstallCount = internalMutation({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
    skillSlug: v.string(),
    installCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_github_namespace", (q) =>
        q
          .eq("githubOwner", args.githubOwner)
          .eq("githubRepo", args.githubRepo)
          .eq("skillSlug", args.skillSlug)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { installCount: args.installCount });
      return { status: "updated" as const };
    }

    return { status: "not_found" as const };
  },
});

export const importFromSkillsSh = action({
  args: {
    maxPages: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    results: SkillsShImportResult[];
    summary: {
      imported: number;
      skipped: number;
      errors: number;
      installCountsUpdated: number;
    };
    reposDiscovered: string[];
  }> => {
    const results: SkillsShImportResult[] = [];
    const reposToImport = new Map<string, RepoToImport>();
    const maxPages = args.maxPages ?? 10;

    const fetchError = await fetchAllSkillsShPages(
      maxPages,
      reposToImport,
      results
    );
    if (fetchError) {
      return {
        results,
        summary: {
          imported: 0,
          skipped: 0,
          errors: 1,
          installCountsUpdated: 0,
        },
        reposDiscovered: [],
      };
    }

    const reposDiscovered = Array.from(reposToImport.keys());
    let installCountsUpdated = 0;

    for (const repoData of reposToImport.values()) {
      const repoResult = await importSingleRepo(ctx, repoData, results);
      installCountsUpdated += repoResult;
    }

    const summary = {
      imported: results.filter((r) => r.status === "imported").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      installCountsUpdated,
    };

    return { results, summary, reposDiscovered };
  },
});

async function fetchAllSkillsShPages(
  maxPages: number,
  reposToImport: Map<string, RepoToImport>,
  results: SkillsShImportResult[]
): Promise<boolean> {
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await fetchSkillsShPage(page);

    if (error || !data) {
      results.push({
        name: `Page ${page}`,
        status: "error",
        reason: error ?? "Failed to fetch",
      });
      return true;
    }

    collectReposFromSkills(data.skills, reposToImport);

    if (!data.hasMore) {
      break;
    }
  }
  return false;
}

type ActionContext = GenericActionCtx<DataModel>;

async function importSingleRepo(
  ctx: ActionContext,
  repoData: RepoToImport,
  results: SkillsShImportResult[]
): Promise<number> {
  let installCountsUpdated = 0;

  try {
    const officialRepo = await ctx.runQuery(api.officialRepos.getByNamespace, {
      githubOwner: repoData.owner,
      githubRepo: repoData.repo,
    });

    const { results: importResults } = await ctx.runAction(
      api.autoImport.importFromGitHubRepo,
      {
        githubOwner: repoData.owner,
        githubRepo: repoData.repo,
        isOfficialSource: officialRepo !== null,
        officialRepoId: officialRepo?._id,
      }
    );

    for (const result of importResults) {
      const matchingSkill = repoData.skills.find((s) =>
        result.name.toLowerCase().includes(s.name.toLowerCase())
      );
      results.push({ ...result, installCount: matchingSkill?.installs });
    }

    installCountsUpdated = await updateInstallCounts(ctx, repoData);
  } catch (error) {
    results.push({
      name: `${repoData.owner}/${repoData.repo}`,
      status: "error",
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return installCountsUpdated;
}

async function updateInstallCounts(
  ctx: ActionContext,
  repoData: RepoToImport
): Promise<number> {
  let updated = 0;

  for (const skill of repoData.skills) {
    const skillSlug = skill.name.toLowerCase().replace(/\s+/g, "-");
    const updateResult = await ctx.runMutation(
      internal.autoImport.updateSkillInstallCount,
      {
        githubOwner: repoData.owner,
        githubRepo: repoData.repo,
        skillSlug,
        installCount: skill.installs,
      }
    );

    if (updateResult.status === "updated") {
      updated++;
    }
  }

  return updated;
}

async function fetchSkillsShDataForRepo(
  owner: string,
  repo: string
): Promise<Map<string, number>> {
  const installCounts = new Map<string, number>();
  const repoKey = `${owner}/${repo}`;

  let page = 1;
  let hasMore = true;
  const maxPages = 20;

  while (hasMore && page <= maxPages) {
    const { data, error } = await fetchSkillsShPage(page);

    if (error || !data) {
      break;
    }

    for (const skill of data.skills) {
      if (skill.topSource === repoKey) {
        installCounts.set(skill.id, skill.installs);
      }
    }

    hasMore = data.hasMore;
    page++;
  }

  return installCounts;
}

export const fetchRepoInstallCounts = action({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalInstalls: number;
    skillCounts: Array<{ skillId: string; installs: number }>;
    updated: number;
  }> => {
    const installCounts = await fetchSkillsShDataForRepo(
      args.githubOwner,
      args.githubRepo
    );

    const skillCounts = Array.from(installCounts.entries()).map(
      ([skillId, installs]) => ({
        skillId,
        installs,
      })
    );

    const totalInstalls = skillCounts.reduce(
      (sum, skill) => sum + skill.installs,
      0
    );

    let updated = 0;
    for (const [skillId, installs] of installCounts) {
      const updateResult = await ctx.runMutation(
        internal.autoImport.updateSkillInstallCount,
        {
          githubOwner: args.githubOwner,
          githubRepo: args.githubRepo,
          skillSlug: skillId,
          installCount: installs,
        }
      );

      if (updateResult.status === "updated") {
        updated++;
      }
    }

    return { totalInstalls, skillCounts, updated };
  },
});

interface SkillsShApiResponseWithOffset {
  skills: SkillsShSkill[];
  hasMore: boolean;
}

interface RepoFromSkillsSh {
  owner: string;
  repo: string;
  totalInstalls: number;
  skillCount: number;
}

const SKILLS_SH_BATCH_SIZE = 100;
const SKILLS_SH_RATE_LIMIT_MS = 50;

async function fetchSkillsShWithOffset(
  offset: number,
  limit: number
): Promise<{ data: SkillsShApiResponseWithOffset | null; error?: string }> {
  try {
    const response = await fetch(
      `https://skills.sh/api/skills?offset=${offset}&limit=${limit}`
    );
    if (!response.ok) {
      return { data: null, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as SkillsShApiResponseWithOffset;
    return { data };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function extractReposFromSkills(
  skills: SkillsShSkill[]
): Map<string, RepoFromSkillsSh> {
  const reposMap = new Map<string, RepoFromSkillsSh>();

  for (const skill of skills) {
    if (!skill.topSource) {
      continue;
    }

    const parts = skill.topSource.split("/");
    if (parts.length !== 2) {
      continue;
    }

    const [owner, repo] = parts;
    if (!(owner && repo)) {
      continue;
    }

    const key = `${owner}/${repo}`;
    const existing = reposMap.get(key);

    if (existing) {
      existing.totalInstalls += skill.installs;
      existing.skillCount += 1;
    } else {
      reposMap.set(key, {
        owner,
        repo,
        totalInstalls: skill.installs,
        skillCount: 1,
      });
    }
  }

  return reposMap;
}

interface FetchAllReposResult {
  totalSkillsFetched: number;
  uniqueReposFound: number;
  reposCreated: number;
  reposUpdated: number;
  repos: Array<{ owner: string; repo: string; status: "created" | "updated" }>;
  error?: string;
}

function mergeRepoData(
  allRepos: Map<string, RepoFromSkillsSh>,
  batchRepos: Map<string, RepoFromSkillsSh>
): void {
  for (const [key, repoData] of batchRepos) {
    const existing = allRepos.get(key);
    if (existing) {
      existing.totalInstalls += repoData.totalInstalls;
      existing.skillCount += repoData.skillCount;
    } else {
      allRepos.set(key, { ...repoData });
    }
  }
}

async function fetchAllSkillsData(maxSkills: number): Promise<{
  allRepos: Map<string, RepoFromSkillsSh>;
  totalSkillsFetched: number;
  error?: string;
}> {
  const allRepos = new Map<string, RepoFromSkillsSh>();
  let offset = 0;
  let totalSkillsFetched = 0;
  let hasMore = true;

  while (hasMore && totalSkillsFetched < maxSkills) {
    const { data, error } = await fetchSkillsShWithOffset(
      offset,
      SKILLS_SH_BATCH_SIZE
    );

    if (error || !data) {
      if (totalSkillsFetched === 0) {
        return {
          allRepos,
          totalSkillsFetched: 0,
          error: error ?? "Failed to fetch skills.sh data",
        };
      }
      break;
    }

    const batchRepos = extractReposFromSkills(data.skills);
    mergeRepoData(allRepos, batchRepos);

    totalSkillsFetched += data.skills.length;
    hasMore = data.hasMore;
    offset += SKILLS_SH_BATCH_SIZE;

    if (hasMore && totalSkillsFetched < maxSkills) {
      await delay(SKILLS_SH_RATE_LIMIT_MS);
    }
  }

  return { allRepos, totalSkillsFetched };
}

export const fetchAllSkillsShRepos = action({
  args: {
    maxSkills: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<FetchAllReposResult> => {
    const maxSkills = args.maxSkills ?? 15_000;

    const { allRepos, totalSkillsFetched, error } =
      await fetchAllSkillsData(maxSkills);

    if (error) {
      return {
        totalSkillsFetched: 0,
        uniqueReposFound: 0,
        reposCreated: 0,
        reposUpdated: 0,
        repos: [],
        error,
      };
    }

    const repos: FetchAllReposResult["repos"] = [];
    let reposCreated = 0;
    let reposUpdated = 0;

    for (const repoData of allRepos.values()) {
      try {
        const result = await ctx.runMutation(
          internal.officialRepos.createOrUpdateOfficialRepo,
          {
            githubOwner: repoData.owner,
            githubRepo: repoData.repo,
            totalInstalls: repoData.totalInstalls,
          }
        );

        repos.push({
          owner: repoData.owner,
          repo: repoData.repo,
          status: result.status,
        });

        if (result.status === "created") {
          reposCreated++;
        } else {
          reposUpdated++;
        }
      } catch (err) {
        console.warn(
          `Failed to create/update repo ${repoData.owner}/${repoData.repo}:`,
          err
        );
      }
    }

    return {
      totalSkillsFetched,
      uniqueReposFound: allRepos.size,
      reposCreated,
      reposUpdated,
      repos,
    };
  },
});

interface SyncFromSkillsShResult {
  totalSkillsFetched: number;
  uniqueReposFound: number;
  reposCreated: number;
  reposUpdated: number;
  skillsCreated: number;
  installCountsUpdated: number;
  error?: string;
}

interface SkillsShSkillData {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

interface ProcessReposResult {
  reposCreated: number;
  reposUpdated: number;
  repoIdMap: Map<string, Id<"officialRepos">>;
}

async function processReposWithProgress(
  ctx: ActionContext,
  reposList: Array<{ owner: string; repo: string; totalInstalls: number }>,
  syncType: string
): Promise<ProcessReposResult> {
  let reposCreated = 0;
  let reposUpdated = 0;
  const repoIdMap = new Map<string, Id<"officialRepos">>();

  for (let i = 0; i < reposList.length; i++) {
    const repoData = reposList[i];
    if (!repoData) {
      continue;
    }

    try {
      const repoResult = await ctx.runMutation(
        internal.officialRepos.createOrUpdateOfficialRepo,
        {
          githubOwner: repoData.owner,
          githubRepo: repoData.repo,
          totalInstalls: repoData.totalInstalls,
        }
      );

      repoIdMap.set(`${repoData.owner}/${repoData.repo}`, repoResult.id);

      if (repoResult.status === "created") {
        reposCreated++;
      } else {
        reposUpdated++;
      }
    } catch (err) {
      console.warn(
        `Failed to create/update repo ${repoData.owner}/${repoData.repo}:`,
        err
      );
    }

    if (i % 10 === 0 || i === reposList.length - 1) {
      await ctx.runMutation(internal.syncProgress.updateProcessingProgress, {
        syncType,
        currentPhase: `Creating repositories... (${i + 1}/${reposList.length})`,
        totalItems: reposList.length,
        processedItems: i + 1,
        reposCreated,
        reposUpdated,
      });
    }
  }

  return { reposCreated, reposUpdated, repoIdMap };
}

interface ProcessSkillsResult {
  skillsCreated: number;
  installCountsUpdated: number;
  contentFetched: number;
}

async function processSkillsWithProgress(
  ctx: ActionContext,
  allSkills: SkillsShSkillData[],
  repoIdMap: Map<string, Id<"officialRepos">>,
  syncType: string
): Promise<ProcessSkillsResult> {
  let skillsCreated = 0;
  let installCountsUpdated = 0;
  let contentFetched = 0;

  for (let i = 0; i < allSkills.length; i++) {
    const skill = allSkills[i];
    if (!skill) {
      continue;
    }

    try {
      const [owner, repo] = skill.topSource.split("/");
      if (!(owner && repo)) {
        continue;
      }

      const officialRepoId = repoIdMap.get(skill.topSource);

      // Fetch content via jsDelivr CDN (no rate limits)
      const content = await fetchSkillContentFromGitHub(owner, repo, skill.id);
      if (content) {
        contentFetched++;
      }

      const result = await ctx.runMutation(
        internal.autoImport.createSkillFromSkillsSh,
        {
          skillId: skill.id,
          name: skill.name,
          installs: skill.installs,
          topSource: skill.topSource,
          githubOwner: owner,
          githubRepo: repo,
          officialRepoId,
          markdown: content?.markdown,
          description: content?.description,
        }
      );

      if (result.status === "created") {
        skillsCreated++;
      }
      if (result.installCountUpdated) {
        installCountsUpdated++;
      }
    } catch (err) {
      console.warn(`Failed to create/update skill ${skill.id}:`, err);
    }

    if (i % 25 === 0 || i === allSkills.length - 1) {
      await ctx.runMutation(internal.syncProgress.updateProcessingProgress, {
        syncType,
        currentPhase: `Processing skills... (${i + 1}/${allSkills.length}, ${contentFetched} with content)`,
        totalItems: allSkills.length,
        processedItems: i + 1,
        skillsCreated,
        installCountsUpdated,
      });
    }

    // Small delay between skills to be a good CDN citizen
    if (i % 10 === 0) {
      await delay(50);
    }
  }

  return { skillsCreated, installCountsUpdated, contentFetched };
}

// Step 1: Fetch repos from skills.sh and create/update them
export const syncReposFromSkillsSh = action({
  args: {
    maxSkills: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxSkills = args.maxSkills ?? 15_000;
    const SYNC_TYPE = "skillssh-repos";

    await ctx.runMutation(internal.syncProgress.start, { syncType: SYNC_TYPE });

    try {
      const { allRepos, totalSkillsFetched, error } =
        await fetchAllSkillsDataWithProgressUpdates(ctx, maxSkills, SYNC_TYPE);

      if (error) {
        await ctx.runMutation(internal.syncProgress.fail, {
          syncType: SYNC_TYPE,
          errorMessage: error,
        });
        return { error, reposCreated: 0, reposUpdated: 0 };
      }

      const reposList = Array.from(allRepos.values());
      const repoResult = await processReposWithProgress(
        ctx,
        reposList,
        SYNC_TYPE
      );

      await ctx.runMutation(internal.syncProgress.complete, {
        syncType: SYNC_TYPE,
        totalSkillsFetched,
        uniqueReposFound: allRepos.size,
        reposCreated: repoResult.reposCreated,
        reposUpdated: repoResult.reposUpdated,
        skillsCreated: 0,
        installCountsUpdated: 0,
      });

      return {
        reposCreated: repoResult.reposCreated,
        reposUpdated: repoResult.reposUpdated,
        totalRepos: allRepos.size,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await ctx.runMutation(internal.syncProgress.fail, {
        syncType: SYNC_TYPE,
        errorMessage,
      });
      return { error: errorMessage, reposCreated: 0, reposUpdated: 0 };
    }
  },
});

// Step 2: Fetch skills metadata from skills.sh (no content)
export const syncSkillsMetadataFromSkillsSh = action({
  args: {
    maxSkills: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxSkills = args.maxSkills ?? 15_000;
    const SYNC_TYPE = "skillssh-metadata";

    await ctx.runMutation(internal.syncProgress.start, { syncType: SYNC_TYPE });

    try {
      const { allRepos, allSkills, totalSkillsFetched, error } =
        await fetchAllSkillsDataWithProgressUpdates(ctx, maxSkills, SYNC_TYPE);

      if (error) {
        await ctx.runMutation(internal.syncProgress.fail, {
          syncType: SYNC_TYPE,
          errorMessage: error,
        });
        return { error, skillsCreated: 0, installCountsUpdated: 0 };
      }

      // Build repo ID map from existing repos
      const repoIdMap = new Map<string, Id<"officialRepos">>();
      for (const [key, repoData] of allRepos) {
        const existing = await ctx.runQuery(
          internal.officialRepos.getByNamespaceInternal,
          { githubOwner: repoData.owner, githubRepo: repoData.repo }
        );
        if (existing) {
          repoIdMap.set(key, existing._id);
        }
      }

      // Process skills without fetching content
      const skillResult = await processSkillsMetadataOnly(
        ctx,
        allSkills,
        repoIdMap,
        SYNC_TYPE
      );

      await ctx.runMutation(internal.syncProgress.complete, {
        syncType: SYNC_TYPE,
        totalSkillsFetched,
        uniqueReposFound: allRepos.size,
        reposCreated: 0,
        reposUpdated: 0,
        skillsCreated: skillResult.skillsCreated,
        installCountsUpdated: skillResult.installCountsUpdated,
      });

      return {
        skillsCreated: skillResult.skillsCreated,
        installCountsUpdated: skillResult.installCountsUpdated,
        totalSkills: totalSkillsFetched,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await ctx.runMutation(internal.syncProgress.fail, {
        syncType: SYNC_TYPE,
        errorMessage,
      });
      return { error: errorMessage, skillsCreated: 0, installCountsUpdated: 0 };
    }
  },
});

// Step 3: Fetch content for existing skills that don't have it
export const syncSkillsContent = action({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalProcessed?: number;
    contentFetched: number;
    contentFailed: number;
    error?: string;
  }> => {
    const batchSize = args.batchSize ?? 500;
    const SYNC_TYPE = "skillssh-content";

    await ctx.runMutation(internal.syncProgress.start, { syncType: SYNC_TYPE });

    try {
      // Get skills that need content (have placeholder markdown)
      const skillsNeedingContent = await ctx.runQuery(
        internal.autoImport.getSkillsNeedingContent,
        { limit: batchSize }
      );

      let contentFetched = 0;
      let contentFailed = 0;

      for (let i = 0; i < skillsNeedingContent.length; i++) {
        const skill = skillsNeedingContent[i];
        if (!skill) {
          continue;
        }

        try {
          const content = await fetchSkillContentFromGitHub(
            skill.githubOwner,
            skill.githubRepo,
            skill.skillSlug
          );

          if (content) {
            await ctx.runMutation(internal.autoImport.updateSkillContent, {
              skillId: skill._id,
              markdown: content.markdown,
              description: content.description,
            });
            contentFetched++;
          } else {
            contentFailed++;
          }
        } catch {
          contentFailed++;
        }

        if (i % 10 === 0 || i === skillsNeedingContent.length - 1) {
          await ctx.runMutation(
            internal.syncProgress.updateProcessingProgress,
            {
              syncType: SYNC_TYPE,
              currentPhase: `Fetching content... (${i + 1}/${skillsNeedingContent.length}, ${contentFetched} fetched)`,
              totalItems: skillsNeedingContent.length,
              processedItems: i + 1,
              skillsCreated: contentFetched,
              installCountsUpdated: contentFailed,
            }
          );
        }

        // Small delay to be a good CDN citizen
        if (i % 5 === 0) {
          await delay(25);
        }
      }

      await ctx.runMutation(internal.syncProgress.complete, {
        syncType: SYNC_TYPE,
        totalSkillsFetched: skillsNeedingContent.length,
        uniqueReposFound: 0,
        reposCreated: 0,
        reposUpdated: 0,
        skillsCreated: contentFetched,
        installCountsUpdated: contentFailed,
      });

      return {
        totalProcessed: skillsNeedingContent.length,
        contentFetched,
        contentFailed,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await ctx.runMutation(internal.syncProgress.fail, {
        syncType: SYNC_TYPE,
        errorMessage,
      });
      return { error: errorMessage, contentFetched: 0, contentFailed: 0 };
    }
  },
});

// Helper: Process skills without fetching content
async function processSkillsMetadataOnly(
  ctx: ActionContext,
  allSkills: SkillsShSkillData[],
  repoIdMap: Map<string, Id<"officialRepos">>,
  syncType: string
): Promise<{ skillsCreated: number; installCountsUpdated: number }> {
  let skillsCreated = 0;
  let installCountsUpdated = 0;

  for (let i = 0; i < allSkills.length; i++) {
    const skill = allSkills[i];
    if (!skill) {
      continue;
    }

    try {
      const [owner, repo] = skill.topSource.split("/");
      if (!(owner && repo)) {
        continue;
      }

      const officialRepoId = repoIdMap.get(skill.topSource);

      const result = await ctx.runMutation(
        internal.autoImport.createSkillFromSkillsSh,
        {
          skillId: skill.id,
          name: skill.name,
          installs: skill.installs,
          topSource: skill.topSource,
          githubOwner: owner,
          githubRepo: repo,
          officialRepoId,
          // No markdown/description - metadata only
        }
      );

      if (result.status === "created") {
        skillsCreated++;
      }
      if (result.installCountUpdated) {
        installCountsUpdated++;
      }
    } catch (err) {
      console.warn(`Failed to create/update skill ${skill.id}:`, err);
    }

    if (i % 50 === 0 || i === allSkills.length - 1) {
      await ctx.runMutation(internal.syncProgress.updateProcessingProgress, {
        syncType,
        currentPhase: `Processing skills... (${i + 1}/${allSkills.length})`,
        totalItems: allSkills.length,
        processedItems: i + 1,
        skillsCreated,
        installCountsUpdated,
      });
    }
  }

  return { skillsCreated, installCountsUpdated };
}

// Legacy: Full sync (kept for backwards compatibility)
export const syncFromSkillsSh = action({
  args: {
    maxSkills: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SyncFromSkillsShResult> => {
    const maxSkills = args.maxSkills ?? 15_000;
    const SYNC_TYPE = "skillssh";

    await ctx.runMutation(internal.syncProgress.start, { syncType: SYNC_TYPE });

    try {
      const { allRepos, allSkills, totalSkillsFetched, error } =
        await fetchAllSkillsDataWithProgressUpdates(ctx, maxSkills, SYNC_TYPE);

      if (error) {
        await ctx.runMutation(internal.syncProgress.fail, {
          syncType: SYNC_TYPE,
          errorMessage: error,
        });
        return {
          totalSkillsFetched: 0,
          uniqueReposFound: 0,
          reposCreated: 0,
          reposUpdated: 0,
          skillsCreated: 0,
          installCountsUpdated: 0,
          error,
        };
      }

      const reposList = Array.from(allRepos.values());
      const repoResult = await processReposWithProgress(
        ctx,
        reposList,
        SYNC_TYPE
      );

      const skillResult = await processSkillsWithProgress(
        ctx,
        allSkills,
        repoResult.repoIdMap,
        SYNC_TYPE
      );

      await ctx.runMutation(internal.syncProgress.complete, {
        syncType: SYNC_TYPE,
        totalSkillsFetched,
        uniqueReposFound: allRepos.size,
        reposCreated: repoResult.reposCreated,
        reposUpdated: repoResult.reposUpdated,
        skillsCreated: skillResult.skillsCreated,
        installCountsUpdated: skillResult.installCountsUpdated,
      });

      return {
        totalSkillsFetched,
        uniqueReposFound: allRepos.size,
        reposCreated: repoResult.reposCreated,
        reposUpdated: repoResult.reposUpdated,
        skillsCreated: skillResult.skillsCreated,
        installCountsUpdated: skillResult.installCountsUpdated,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during sync";
      await ctx.runMutation(internal.syncProgress.fail, {
        syncType: SYNC_TYPE,
        errorMessage,
      });
      return {
        totalSkillsFetched: 0,
        uniqueReposFound: 0,
        reposCreated: 0,
        reposUpdated: 0,
        skillsCreated: 0,
        installCountsUpdated: 0,
        error: errorMessage,
      };
    }
  },
});

async function fetchAllSkillsDataWithProgressUpdates(
  ctx: ActionContext,
  maxSkills: number,
  syncType: string
): Promise<{
  allRepos: Map<string, { owner: string; repo: string; totalInstalls: number }>;
  allSkills: SkillsShSkillData[];
  totalSkillsFetched: number;
  error?: string;
}> {
  const allRepos = new Map<
    string,
    { owner: string; repo: string; totalInstalls: number }
  >();
  const allSkills: SkillsShSkillData[] = [];

  try {
    let offset = 0;
    const batchSize = 100;

    while (allSkills.length < maxSkills) {
      const { data, error } = await fetchSkillsShWithOffset(offset, batchSize);
      if (error || !data?.skills || data.skills.length === 0) {
        if (error && allSkills.length === 0) {
          return { allRepos, allSkills, totalSkillsFetched: 0, error };
        }
        break;
      }

      for (const skill of data.skills) {
        allSkills.push(skill);
        addSkillToRepoMap(skill, allRepos);
      }

      // Update fetch progress every batch
      await ctx.runMutation(internal.syncProgress.updateFetchProgress, {
        syncType,
        totalSkillsFetched: allSkills.length,
        uniqueReposFound: allRepos.size,
        currentPhase: `Fetching skills from skills.sh... (${allSkills.length} skills, ${allRepos.size} repos)`,
      });

      if (!data.hasMore) {
        break;
      }
      offset += batchSize;

      // Small delay to avoid rate limiting
      await delay(50);
    }

    return { allRepos, allSkills, totalSkillsFetched: allSkills.length };
  } catch (err) {
    return {
      allRepos,
      allSkills,
      totalSkillsFetched: allSkills.length,
      error: err instanceof Error ? err.message : "Failed to fetch skills.sh",
    };
  }
}

function addSkillToRepoMap(
  skill: SkillsShSkillData,
  allRepos: Map<string, { owner: string; repo: string; totalInstalls: number }>
): void {
  if (!skill.topSource) {
    return;
  }
  const [owner, repo] = skill.topSource.split("/");
  if (!(owner && repo)) {
    return;
  }
  const key = `${owner}/${repo}`;
  const existing = allRepos.get(key);
  if (existing) {
    existing.totalInstalls += skill.installs;
  } else {
    allRepos.set(key, { owner, repo, totalInstalls: skill.installs });
  }
}

// Fetch skill content using jsDelivr CDN (no rate limits, unlike raw.githubusercontent.com)
// jsDelivr mirrors GitHub content and has no rate limits
async function fetchSkillContentFromGitHub(
  owner: string,
  repo: string,
  skillId: string
): Promise<{ markdown: string; description: string } | null> {
  // Try multiple possible paths for the skill content
  // Pattern 1: skills/{skill-name}/SKILL.md or AGENTS.md
  // Pattern 2: .skills/{skill-name}.md
  // Pattern 3: skills/{normalized-name}/SKILL.md (remove owner prefix)

  const normalizedSkillId = skillId
    .replace(new RegExp(`^${owner}-`, "i"), "") // Remove owner prefix
    .replace(new RegExp(`^${repo}-`, "i"), ""); // Remove repo prefix

  const possiblePaths = [
    `skills/${skillId}/SKILL.md`,
    `skills/${skillId}/AGENTS.md`,
    `skills/${skillId}/README.md`,
    `skills/${normalizedSkillId}/SKILL.md`,
    `skills/${normalizedSkillId}/AGENTS.md`,
    `skills/${normalizedSkillId}/README.md`,
    `.skills/${skillId}.md`,
    `.skills/${normalizedSkillId}.md`,
    `${skillId}.md`,
    `${normalizedSkillId}.md`,
  ];

  // Use jsDelivr CDN which mirrors GitHub content with no rate limits
  // Format: https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}
  for (const path of possiblePaths) {
    const url = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${path}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const markdown = await response.text();
        // Extract description from first paragraph or first 200 chars
        const description = extractDescription(markdown);
        return { markdown, description };
      }
    } catch {
      // Try next path
    }
  }

  return null;
}

// Regex patterns for extracting description from markdown
const DESC_FRONTMATTER_REGEX = /^---[\s\S]*?---\n*/m;
const DESC_TITLE_REGEX = /^#\s+.*\n*/m;
const DESC_PARAGRAPH_SPLIT_REGEX = /\n\n/;
const DESC_BOLD_REGEX = /\*\*/g;
const DESC_ITALIC_REGEX = /\*/g;
const DESC_CODE_REGEX = /`/g;
const DESC_LINK_REGEX = /\[([^\]]+)\]\([^)]+\)/g;

function extractDescription(markdown: string): string {
  // Remove frontmatter if present
  let content = markdown.replace(DESC_FRONTMATTER_REGEX, "");
  // Remove title
  content = content.replace(DESC_TITLE_REGEX, "");
  // Get first paragraph
  const firstParagraph =
    content.split(DESC_PARAGRAPH_SPLIT_REGEX)[0]?.trim() || "";
  // Clean up markdown formatting
  const cleanText = firstParagraph
    .replace(DESC_BOLD_REGEX, "")
    .replace(DESC_ITALIC_REGEX, "")
    .replace(DESC_CODE_REGEX, "")
    .replace(DESC_LINK_REGEX, "$1")
    .trim();
  // Limit to 300 characters
  if (cleanText.length > 300) {
    return `${cleanText.substring(0, 297)}...`;
  }
  return cleanText || `Skill from ${markdown.substring(0, 100)}...`;
}

// Query to get skills that need content (have placeholder markdown)
export const getSkillsNeedingContent = internalQuery({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .filter((q) =>
        q.and(
          q.neq(q.field("githubOwner"), undefined),
          q.neq(q.field("skillSlug"), undefined)
        )
      )
      .take(args.limit * 2); // Take extra to filter

    // Filter to skills with placeholder content
    return skills
      .filter(
        (s) =>
          s.markdown.includes("This skill was discovered from skills.sh") ||
          s.markdown.includes("Content will be fetched")
      )
      .slice(0, args.limit)
      .map((s) => ({
        _id: s._id,
        githubOwner: s.githubOwner as string,
        githubRepo: s.githubRepo as string,
        skillSlug: s.skillSlug as string,
      }));
  },
});

// Mutation to update skill content
export const updateSkillContent = internalMutation({
  args: {
    skillId: v.id("skills"),
    markdown: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.skillId, {
      markdown: args.markdown,
      description: args.description,
    });
  },
});

export const createSkillFromSkillsSh = internalMutation({
  args: {
    skillId: v.string(),
    name: v.string(),
    installs: v.number(),
    topSource: v.string(),
    githubOwner: v.string(),
    githubRepo: v.string(),
    officialRepoId: v.optional(v.id("officialRepos")),
    markdown: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    status: "created" | "exists";
    installCountUpdated: boolean;
    contentUpdated: boolean;
  }> => {
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_owner_slug", (q) =>
        q.eq("githubOwner", args.githubOwner).eq("skillSlug", args.skillId)
      )
      .first();

    if (existing) {
      const installCountUpdated = existing.installCount !== args.installs;
      const needsContentUpdate =
        args.markdown &&
        existing.markdown.includes("This skill was discovered from skills.sh");

      const updates: Record<string, unknown> = {};
      if (installCountUpdated) {
        updates.installCount = args.installs;
      }
      if (needsContentUpdate && args.markdown) {
        updates.markdown = args.markdown;
        if (args.description) {
          updates.description = args.description;
        }
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }

      return {
        status: "exists",
        installCountUpdated,
        contentUpdated: !!needsContentUpdate,
      };
    }

    const sourceUrl = `https://github.com/${args.githubOwner}/${args.githubRepo}`;

    const finalMarkdown =
      args.markdown ||
      `# ${args.name}\n\nThis skill was discovered from skills.sh. Content will be fetched from the source repository.`;
    const finalDescription = args.description || `Skill from ${args.topSource}`;

    await ctx.db.insert("skills", {
      name: args.name,
      description: finalDescription,
      category: "uncategorized",
      authorId: args.githubOwner,
      authorName: args.githubOwner,
      markdown: finalMarkdown,
      tags: [],
      color: "#6366f1",
      sourceUrl,
      sourcePath: "",
      githubOwner: args.githubOwner,
      githubRepo: args.githubRepo,
      skillSlug: args.skillId,
      isOfficialSource: !!args.officialRepoId,
      officialRepoId: args.officialRepoId,
      installCount: args.installs,
      isArchived: false,
      moderationStatus: "visible",
    });

    return {
      status: "created",
      installCountUpdated: false,
      contentUpdated: false,
    };
  },
});
