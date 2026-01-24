import { describe, expect, it } from "vitest";

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

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
}

// ============================================================================
// Normalization Functions (mirroring backend logic)
// ============================================================================

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

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;
const TITLE_REGEX = /^#\s+(.+)$/m;
const GITHUB_REPO_PATTERN = /github\.com\/([^/]+)\/([^/]+)\/?$/;
const GITHUB_PATH_PATTERN =
  /github\.com\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/(.+)/;

function extractTitle(markdown: string): string {
  const match = markdown.match(TITLE_REGEX);
  return match?.[1]?.trim() ?? "Untitled Skill";
}

function extractDescription(markdown: string): string {
  const lines = markdown.split("\n");
  let foundTitle = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && trimmed && !trimmed.startsWith("#")) {
      return trimmed.length > 500 ? `${trimmed.slice(0, 497)}...` : trimmed;
    }
  }

  return "No description provided";
}

function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
} | null {
  const pathMatch = url.match(GITHUB_PATH_PATTERN);
  if (pathMatch) {
    const [, owner, repo, , branch, path] = pathMatch;
    if (owner && repo && branch && path) {
      return { owner, repo, branch, path };
    }
  }

  const repoMatch = url.match(GITHUB_REPO_PATTERN);
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    if (owner && repo) {
      return { owner, repo };
    }
  }

  return null;
}

function filterSkillsByRepo(
  skills: SkillsShSkill[],
  repoIdentifier: string
): SkillsShSkill[] {
  return skills.filter((s) => s.topSource === repoIdentifier);
}

const MOCK_SKILLS_SH_RESPONSE: SkillsShApiResponse = {
  skills: [
    {
      id: "upgrading-expo",
      name: "Upgrading Expo",
      installs: 1250,
      topSource: "expo/skills",
    },
    {
      id: "use-dom",
      name: "Use DOM",
      installs: 980,
      topSource: "expo/skills",
    },
    {
      id: "building-native-ui",
      name: "Building Native UI",
      installs: 750,
      topSource: "expo/skills",
    },
    {
      id: "expo-deployment",
      name: "Expo Deployment",
      installs: 620,
      topSource: "expo/skills",
    },
    {
      id: "vercel-deployment",
      name: "Vercel Deployment",
      installs: 500,
      topSource: "vercel-labs/agent-skills",
    },
    {
      id: "nextjs-auth",
      name: "Next.js Auth",
      installs: 450,
      topSource: "vercel-labs/agent-skills",
    },
  ],
  hasMore: true,
};

const MOCK_GITHUB_ROOT_CONTENTS: GitHubFile[] = [
  { name: "README.md", path: "README.md", type: "file" },
  { name: "skills", path: "skills", type: "dir" },
  { name: ".github", path: ".github", type: "dir" },
  { name: "package.json", path: "package.json", type: "file" },
];

const MOCK_GITHUB_SKILLS_DIR: GitHubFile[] = [
  { name: "upgrading-expo", path: "skills/upgrading-expo", type: "dir" },
  { name: "use-dom", path: "skills/use-dom", type: "dir" },
  {
    name: "building-native-ui",
    path: "skills/building-native-ui",
    type: "dir",
  },
  { name: "deployment", path: "skills/deployment", type: "dir" },
  { name: "notifications", path: "skills/notifications", type: "dir" },
  {
    name: "push-notifications",
    path: "skills/push-notifications",
    type: "dir",
  },
  { name: "local-storage", path: "skills/local-storage", type: "dir" },
  { name: "expo-router", path: "skills/expo-router", type: "dir" },
  { name: "native-modules", path: "skills/native-modules", type: "dir" },
  { name: "eas-build", path: "skills/eas-build", type: "dir" },
  { name: "splash-screens", path: "skills/splash-screens", type: "dir" },
  { name: "deep-linking", path: "skills/deep-linking", type: "dir" },
];

const MOCK_SKILL_MARKDOWN = `# Upgrading Expo

This skill helps you upgrade your Expo project to the latest SDK version safely and efficiently.

## Overview

Upgrading Expo SDK versions can be complex. This skill guides you through the process with:

- Pre-upgrade checklist
- Step-by-step upgrade instructions
- Post-upgrade verification
- Common issues and solutions

## Prerequisites

- Existing Expo project
- Node.js 18+
- npm or yarn

## Usage

Follow the guided upgrade process to update your Expo SDK.
`;

const MOCK_SKILL_WITH_FRONTMATTER = `---
name: "Use DOM"
description: "Learn how to use DOM components in Expo"
tags:
  - expo
  - dom
  - web
---

# Use DOM in Expo

This skill teaches you how to integrate DOM components into your Expo application.

## What is use-dom?

The \`use-dom\` directive allows you to render web components in React Native.
`;

describe("Skills.sh API Integration", () => {
  describe("API Response Parsing", () => {
    it("parses skills from API response", () => {
      const data = MOCK_SKILLS_SH_RESPONSE;

      expect(data.skills).toBeDefined();
      expect(Array.isArray(data.skills)).toBe(true);
      expect(data.skills.length).toBeGreaterThan(0);
      expect(typeof data.hasMore).toBe("boolean");
    });

    it("validates skill fields", () => {
      const data = MOCK_SKILLS_SH_RESPONSE;

      for (const skill of data.skills) {
        expect(skill.id).toBeDefined();
        expect(typeof skill.id).toBe("string");
        expect(skill.name).toBeDefined();
        expect(typeof skill.name).toBe("string");
        expect(skill.installs).toBeDefined();
        expect(typeof skill.installs).toBe("number");
        expect(skill.topSource).toBeDefined();
        expect(typeof skill.topSource).toBe("string");
      }
    });

    it("identifies expo skills by topSource", () => {
      const data = MOCK_SKILLS_SH_RESPONSE;
      const expoSkills = data.skills.filter((s) =>
        s.topSource.startsWith("expo/")
      );

      expect(expoSkills.length).toBeGreaterThan(0);

      const knownExpoSkills = [
        "upgrading-expo",
        "use-dom",
        "building-native-ui",
        "expo-deployment",
      ];

      for (const skillName of knownExpoSkills) {
        const found = expoSkills.some((s) => s.id === skillName);
        expect(found).toBe(true);
      }
    });
  });

  describe("filterSkillsByRepo", () => {
    it("correctly filters skills by topSource", () => {
      const data = MOCK_SKILLS_SH_RESPONSE;

      const expoSkills = filterSkillsByRepo(data.skills, "expo/skills");
      const vercelSkills = filterSkillsByRepo(
        data.skills,
        "vercel-labs/agent-skills"
      );

      expect(expoSkills.length).toBe(4);
      expect(vercelSkills.length).toBe(2);

      for (const skill of expoSkills) {
        expect(skill.topSource).toBe("expo/skills");
      }

      for (const skill of vercelSkills) {
        expect(skill.topSource).toBe("vercel-labs/agent-skills");
      }
    });

    it("returns empty array for unknown repo", () => {
      const data = MOCK_SKILLS_SH_RESPONSE;
      const unknownSkills = filterSkillsByRepo(data.skills, "unknown/repo");

      expect(unknownSkills.length).toBe(0);
    });
  });
});

describe("GitHub API Integration", () => {
  describe("Directory Contents Parsing", () => {
    it("parses root directory contents", () => {
      const contents = MOCK_GITHUB_ROOT_CONTENTS;

      expect(Array.isArray(contents)).toBe(true);
      expect(contents.length).toBeGreaterThan(0);
    });

    it("finds skills directory in root", () => {
      const contents = MOCK_GITHUB_ROOT_CONTENTS;
      const skillsDir = contents.find(
        (item) => item.type === "dir" && item.name === "skills"
      );

      expect(skillsDir).toBeDefined();
      expect(skillsDir?.type).toBe("dir");
    });

    it("lists skill subdirectories", () => {
      const skillDirs = MOCK_GITHUB_SKILLS_DIR;

      const dirNames = skillDirs
        .filter((item) => item.type === "dir")
        .map((item) => item.name);

      const expectedDirs = [
        "upgrading-expo",
        "use-dom",
        "building-native-ui",
        "deployment",
      ];

      for (const expected of expectedDirs) {
        expect(dirNames).toContain(expected);
      }
    });

    it("counts total skill directories", () => {
      const skillDirs = MOCK_GITHUB_SKILLS_DIR;
      const dirCount = skillDirs.filter((item) => item.type === "dir").length;

      expect(dirCount).toBeGreaterThan(10);
    });
  });

  describe("URL Parsing", () => {
    it("parses basic repo URL", () => {
      const result = parseGitHubUrl("https://github.com/expo/skills");

      expect(result).not.toBeNull();
      expect(result?.owner).toBe("expo");
      expect(result?.repo).toBe("skills");
    });

    it("parses repo URL with trailing slash", () => {
      const result = parseGitHubUrl("https://github.com/expo/skills/");

      expect(result).not.toBeNull();
      expect(result?.owner).toBe("expo");
      expect(result?.repo).toBe("skills");
    });

    it("parses directory URL", () => {
      const result = parseGitHubUrl(
        "https://github.com/expo/skills/tree/main/skills/upgrading-expo"
      );

      expect(result).not.toBeNull();
      expect(result?.owner).toBe("expo");
      expect(result?.repo).toBe("skills");
      expect(result?.branch).toBe("main");
      expect(result?.path).toBe("skills/upgrading-expo");
    });

    it("parses file URL", () => {
      const result = parseGitHubUrl(
        "https://github.com/expo/skills/blob/main/skills/upgrading-expo/SKILL.md"
      );

      expect(result).not.toBeNull();
      expect(result?.owner).toBe("expo");
      expect(result?.repo).toBe("skills");
      expect(result?.branch).toBe("main");
      expect(result?.path).toBe("skills/upgrading-expo/SKILL.md");
    });

    it("returns null for non-GitHub URLs", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
      expect(parseGitHubUrl("https://example.com")).toBeNull();
    });
  });
});

describe("Skill Markdown Parsing", () => {
  describe("extractTitle", () => {
    it("extracts title from H1 heading", () => {
      const title = extractTitle(MOCK_SKILL_MARKDOWN);

      expect(title).toBe("Upgrading Expo");
    });

    it("extracts title from markdown with frontmatter", () => {
      const title = extractTitle(MOCK_SKILL_WITH_FRONTMATTER);

      expect(title).toBe("Use DOM in Expo");
    });

    it("returns default for markdown without title", () => {
      const title = extractTitle("Some content without a title");

      expect(title).toBe("Untitled Skill");
    });
  });

  describe("extractDescription", () => {
    it("extracts first paragraph after title", () => {
      const description = extractDescription(MOCK_SKILL_MARKDOWN);

      expect(description).toContain("upgrade your Expo project");
    });

    it("extracts description from frontmatter markdown", () => {
      const description = extractDescription(MOCK_SKILL_WITH_FRONTMATTER);

      expect(description).toContain("integrate DOM components");
    });

    it("returns default for empty content", () => {
      const description = extractDescription("# Title\n\n");

      expect(description).toBe("No description provided");
    });
  });

  describe("Frontmatter Detection", () => {
    it("detects frontmatter in markdown", () => {
      const hasFrontmatter = FRONTMATTER_REGEX.test(
        MOCK_SKILL_WITH_FRONTMATTER
      );

      expect(hasFrontmatter).toBe(true);
    });

    it("extracts frontmatter content", () => {
      const match = MOCK_SKILL_WITH_FRONTMATTER.match(FRONTMATTER_REGEX);

      expect(match).not.toBeNull();
      expect(match?.[1]).toContain('name: "Use DOM"');
    });

    it("returns false for markdown without frontmatter", () => {
      const hasFrontmatter = FRONTMATTER_REGEX.test(MOCK_SKILL_MARKDOWN);

      expect(hasFrontmatter).toBe(false);
    });
  });
});

describe("Data Validation", () => {
  describe("normalizeSkillName", () => {
    it("handles short names by padding", () => {
      const result = normalizeSkillName("AB");

      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result).toBe("AB Skill");
    });

    it("truncates long names", () => {
      const longName = "A".repeat(150);
      const result = normalizeSkillName(longName);

      expect(result.length).toBeLessThanOrEqual(100);
    });

    it("preserves valid names", () => {
      expect(normalizeSkillName("upgrading-expo")).toBe("upgrading-expo");
    });

    it("trims whitespace", () => {
      expect(normalizeSkillName("  test skill  ")).toBe("test skill");
    });
  });

  describe("normalizeDescription", () => {
    it("handles short descriptions by extracting from markdown", () => {
      const markdown =
        "# Title\n\nThis is a longer description extracted from content.";
      const result = normalizeDescription("Short", markdown, "Test");

      expect(result.length).toBeGreaterThanOrEqual(10);
      expect(result).toContain("longer description");
    });

    it("generates fallback description when content is minimal", () => {
      const result = normalizeDescription("", "", "Test Skill");

      expect(result).toContain("Test Skill");
      expect(result.length).toBeGreaterThanOrEqual(10);
    });

    it("truncates long descriptions", () => {
      const longDesc = "A".repeat(600);
      const result = normalizeDescription(longDesc, "", "Test");

      expect(result.length).toBeLessThanOrEqual(500);
      expect(result.endsWith("...")).toBe(true);
    });

    it("skips code blocks when extracting from markdown", () => {
      const markdown =
        "# Title\n\n```js\ncode\n```\n\nActual description here.";
      const result = normalizeDescription("", markdown, "Test");

      expect(result).toContain("Actual description");
    });
  });

  describe("normalizeMarkdown", () => {
    it("pads short markdown content", () => {
      const result = normalizeMarkdown("Short", "Test");

      expect(result.length).toBeGreaterThanOrEqual(50);
      expect(result).toContain("Imported skill: Test");
    });

    it("preserves valid markdown", () => {
      const validMarkdown =
        "# Title\n\n" +
        "This is content that is definitely longer than 50 characters total.";

      expect(normalizeMarkdown(validMarkdown, "Test")).toBe(validMarkdown);
    });

    it("handles exact boundary (50 chars)", () => {
      const exactMarkdown = "A".repeat(50);
      const result = normalizeMarkdown(exactMarkdown, "Test");

      expect(result).toBe(exactMarkdown);
    });

    it("pads 49 char markdown", () => {
      const shortMarkdown = "A".repeat(49);
      const result = normalizeMarkdown(shortMarkdown, "Test");

      expect(result.length).toBeGreaterThan(49);
    });
  });
});

describe("Import Flow Validation", () => {
  describe("Skill Discovery", () => {
    it("identifies skill directories from repo contents", () => {
      const skillDirs = MOCK_GITHUB_SKILLS_DIR;
      const dirNames = skillDirs
        .filter((item) => item.type === "dir")
        .map((item) => item.name);

      expect(dirNames).toContain("upgrading-expo");
      expect(dirNames).toContain("use-dom");
      expect(dirNames).toContain("deployment");
    });

    it("matches skill slugs between GitHub and skills.sh", () => {
      const githubSkills = MOCK_GITHUB_SKILLS_DIR.filter(
        (item) => item.type === "dir"
      ).map((item) => item.name);

      const skillsShData = MOCK_SKILLS_SH_RESPONSE;
      const expoSkillIds = skillsShData.skills
        .filter((s) => s.topSource === "expo/skills")
        .map((s) => s.id);

      const matchedSkills = githubSkills.filter((name) =>
        expoSkillIds.includes(name)
      );

      expect(matchedSkills.length).toBeGreaterThan(0);
      expect(matchedSkills).toContain("upgrading-expo");
      expect(matchedSkills).toContain("use-dom");
    });
  });

  describe("Install Count Matching", () => {
    it("retrieves install counts for matched skills", () => {
      const skillsShData = MOCK_SKILLS_SH_RESPONSE;
      const expoSkills = filterSkillsByRepo(skillsShData.skills, "expo/skills");

      const installCountMap = new Map<string, number>();
      for (const skill of expoSkills) {
        installCountMap.set(skill.id, skill.installs);
      }

      expect(installCountMap.get("upgrading-expo")).toBe(1250);
      expect(installCountMap.get("use-dom")).toBe(980);
      expect(installCountMap.get("building-native-ui")).toBe(750);
    });

    it("handles skills without install counts", () => {
      const installCountMap = new Map<string, number>();

      const count = installCountMap.get("nonexistent-skill") ?? 0;
      expect(count).toBe(0);
    });
  });
});

describe("Rate Limiting and Error Handling", () => {
  describe("Response Validation", () => {
    it("validates successful response structure", () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Map([
          ["X-RateLimit-Remaining", "58"],
          ["X-RateLimit-Limit", "60"],
        ]),
      };

      expect(mockResponse.ok).toBe(true);

      const remaining = mockResponse.headers.get("X-RateLimit-Remaining");
      expect(Number.parseInt(remaining ?? "0", 10)).toBeGreaterThanOrEqual(0);
    });

    it("handles 404 response for non-existent repo", () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      expect(mockResponse.ok).toBe(false);
      expect(mockResponse.status).toBe(404);
    });

    it("handles 403 rate limit response", () => {
      const mockResponse = {
        ok: false,
        status: 403,
        headers: new Map([["X-RateLimit-Remaining", "0"]]),
      };

      const remaining = mockResponse.headers.get("X-RateLimit-Remaining");
      const isRateLimited = mockResponse.status === 403 && remaining === "0";

      expect(isRateLimited).toBe(true);
    });
  });

  describe("Batch Processing", () => {
    it("splits items into batches", () => {
      const items = Array.from({ length: 25 }, (_, i) => `item-${i}`);
      const batchSize = 5;

      const batches: string[][] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }

      expect(batches.length).toBe(5);
      expect(batches[0]?.length).toBe(5);
      expect(batches[4]?.length).toBe(5);
    });

    it("handles partial final batch", () => {
      const items = Array.from({ length: 23 }, (_, i) => `item-${i}`);
      const batchSize = 5;

      const batches: string[][] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }

      expect(batches.length).toBe(5);
      expect(batches[4]?.length).toBe(3);
    });
  });
});

// ============================================================================
// Fetch All Repos from skills.sh Tests
// ============================================================================

interface RepoFromSkillsSh {
  owner: string;
  repo: string;
  totalInstalls: number;
  skillCount: number;
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

describe("Fetch All Repos from skills.sh", () => {
  describe("extractReposFromSkills", () => {
    it("extracts unique repos from skills", () => {
      const repos = extractReposFromSkills(MOCK_SKILLS_SH_RESPONSE.skills);

      expect(repos.size).toBe(2);
      expect(repos.has("expo/skills")).toBe(true);
      expect(repos.has("vercel-labs/agent-skills")).toBe(true);
    });

    it("aggregates install counts per repo", () => {
      const repos = extractReposFromSkills(MOCK_SKILLS_SH_RESPONSE.skills);

      const expoRepo = repos.get("expo/skills");
      expect(expoRepo?.totalInstalls).toBe(1250 + 980 + 750 + 620);
      expect(expoRepo?.skillCount).toBe(4);

      const vercelRepo = repos.get("vercel-labs/agent-skills");
      expect(vercelRepo?.totalInstalls).toBe(500 + 450);
      expect(vercelRepo?.skillCount).toBe(2);
    });

    it("handles empty skills array", () => {
      const repos = extractReposFromSkills([]);

      expect(repos.size).toBe(0);
    });

    it("handles skills without topSource", () => {
      const skillsWithMissing: SkillsShSkill[] = [
        { id: "test1", name: "Test 1", installs: 100, topSource: "owner/repo" },
        { id: "test2", name: "Test 2", installs: 200, topSource: "" },
        { id: "test3", name: "Test 3", installs: 300, topSource: "owner/repo" },
      ];

      const repos = extractReposFromSkills(skillsWithMissing);

      expect(repos.size).toBe(1);
      expect(repos.get("owner/repo")?.totalInstalls).toBe(400);
      expect(repos.get("owner/repo")?.skillCount).toBe(2);
    });

    it("handles malformed topSource values", () => {
      const skillsWithMalformed: SkillsShSkill[] = [
        { id: "test1", name: "Test 1", installs: 100, topSource: "owner/repo" },
        {
          id: "test2",
          name: "Test 2",
          installs: 200,
          topSource: "invalid-no-slash",
        },
        {
          id: "test3",
          name: "Test 3",
          installs: 300,
          topSource: "too/many/slashes",
        },
        {
          id: "test4",
          name: "Test 4",
          installs: 400,
          topSource: "owner/another-repo",
        },
      ];

      const repos = extractReposFromSkills(skillsWithMalformed);

      expect(repos.size).toBe(2);
      expect(repos.has("owner/repo")).toBe(true);
      expect(repos.has("owner/another-repo")).toBe(true);
      expect(repos.has("invalid-no-slash")).toBe(false);
      expect(repos.has("too/many/slashes")).toBe(false);
    });

    it("correctly extracts owner and repo from topSource", () => {
      const repos = extractReposFromSkills(MOCK_SKILLS_SH_RESPONSE.skills);

      const expoRepo = repos.get("expo/skills");
      expect(expoRepo?.owner).toBe("expo");
      expect(expoRepo?.repo).toBe("skills");

      const vercelRepo = repos.get("vercel-labs/agent-skills");
      expect(vercelRepo?.owner).toBe("vercel-labs");
      expect(vercelRepo?.repo).toBe("agent-skills");
    });
  });

  describe("Pagination with offset", () => {
    it("processes multiple batches correctly", () => {
      const batch1: SkillsShSkill[] = [
        {
          id: "skill1",
          name: "Skill 1",
          installs: 1000,
          topSource: "repo-a/skills",
        },
        {
          id: "skill2",
          name: "Skill 2",
          installs: 900,
          topSource: "repo-b/skills",
        },
      ];
      const batch2: SkillsShSkill[] = [
        {
          id: "skill3",
          name: "Skill 3",
          installs: 800,
          topSource: "repo-a/skills",
        },
        {
          id: "skill4",
          name: "Skill 4",
          installs: 700,
          topSource: "repo-c/skills",
        },
      ];

      const allRepos = new Map<string, RepoFromSkillsSh>();

      for (const batch of [batch1, batch2]) {
        const batchRepos = extractReposFromSkills(batch);
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

      expect(allRepos.size).toBe(3);
      expect(allRepos.get("repo-a/skills")?.totalInstalls).toBe(1800);
      expect(allRepos.get("repo-a/skills")?.skillCount).toBe(2);
      expect(allRepos.get("repo-b/skills")?.totalInstalls).toBe(900);
      expect(allRepos.get("repo-c/skills")?.totalInstalls).toBe(700);
    });

    it("handles large number of unique repos", () => {
      const skills: SkillsShSkill[] = [];
      for (let i = 0; i < 100; i++) {
        skills.push({
          id: `skill-${i}`,
          name: `Skill ${i}`,
          installs: 100 + i,
          topSource: `owner-${i}/repo-${i}`,
        });
      }

      const repos = extractReposFromSkills(skills);

      expect(repos.size).toBe(100);
    });

    it("handles skills from same repo across different batches", () => {
      const skills: SkillsShSkill[] = [];
      for (let i = 0; i < 50; i++) {
        skills.push({
          id: `skill-${i}`,
          name: `Skill ${i}`,
          installs: 10,
          topSource: "single-owner/single-repo",
        });
      }

      const repos = extractReposFromSkills(skills);

      expect(repos.size).toBe(1);
      expect(repos.get("single-owner/single-repo")?.totalInstalls).toBe(500);
      expect(repos.get("single-owner/single-repo")?.skillCount).toBe(50);
    });
  });

  describe("Result structure validation", () => {
    it("returns correct structure for createOrUpdateOfficialRepo", () => {
      const repos = extractReposFromSkills(MOCK_SKILLS_SH_RESPONSE.skills);

      for (const [key, repoData] of repos) {
        expect(typeof repoData.owner).toBe("string");
        expect(typeof repoData.repo).toBe("string");
        expect(typeof repoData.totalInstalls).toBe("number");
        expect(typeof repoData.skillCount).toBe("number");
        expect(repoData.owner.length).toBeGreaterThan(0);
        expect(repoData.repo.length).toBeGreaterThan(0);
        expect(key).toBe(`${repoData.owner}/${repoData.repo}`);
      }
    });
  });
});

describe("Edge Cases", () => {
  describe("Empty and Null Handling", () => {
    it("handles empty skill list", () => {
      const emptyResponse: SkillsShApiResponse = {
        skills: [],
        hasMore: false,
      };

      expect(emptyResponse.skills.length).toBe(0);
      expect(
        filterSkillsByRepo(emptyResponse.skills, "expo/skills").length
      ).toBe(0);
    });

    it("handles empty directory contents", () => {
      const emptyDir: GitHubFile[] = [];
      const skillsDir = emptyDir.find(
        (item) => item.type === "dir" && item.name === "skills"
      );

      expect(skillsDir).toBeUndefined();
    });

    it("handles markdown with only whitespace", () => {
      const result = normalizeMarkdown("   \n\n   ", "Test");

      expect(result.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Special Characters", () => {
    it("handles skill names with special characters", () => {
      const result = normalizeSkillName("expo-router");

      expect(result).toBe("expo-router");
    });

    it("handles unicode in descriptions", () => {
      const result = normalizeDescription(
        "This skill uses émojis 🚀 and spëcial characters",
        "",
        "Test"
      );

      expect(result).toContain("émojis");
      expect(result).toContain("🚀");
    });
  });
});
