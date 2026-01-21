import { describe, expect, it } from "vitest";

import { isDirectFileUrl, isRepoUrl, parseGitHubUrl } from "../github-fetcher";

describe("parseGitHubUrl", () => {
  describe("repository URLs", () => {
    it("parses basic repo URL", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo");

      expect(result).toEqual({
        type: "repo",
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses repo URL with trailing slash", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo/");

      expect(result).toEqual({
        type: "repo",
        owner: "owner",
        repo: "repo",
      });
    });
  });

  describe("file URLs (blob)", () => {
    it("parses direct file URL", () => {
      const result = parseGitHubUrl(
        "https://github.com/owner/repo/blob/main/path/to/SKILL.md"
      );

      expect(result).toEqual({
        type: "file",
        owner: "owner",
        repo: "repo",
        branch: "main",
        path: "path/to/SKILL.md",
      });
    });

    it("parses file URL with master branch", () => {
      const result = parseGitHubUrl(
        "https://github.com/owner/repo/blob/master/SKILL.md"
      );

      expect(result).toEqual({
        type: "file",
        owner: "owner",
        repo: "repo",
        branch: "master",
        path: "SKILL.md",
      });
    });

    it("parses file URL with feature branch", () => {
      const result = parseGitHubUrl(
        "https://github.com/owner/repo/blob/feature/test/src/file.ts"
      );

      expect(result).toEqual({
        type: "file",
        owner: "owner",
        repo: "repo",
        branch: "feature",
        path: "test/src/file.ts",
      });
    });
  });

  describe("directory URLs (tree)", () => {
    it("parses directory URL", () => {
      const result = parseGitHubUrl(
        "https://github.com/anthropics/skills/tree/main/skills/docx"
      );

      expect(result).toEqual({
        type: "directory",
        owner: "anthropics",
        repo: "skills",
        branch: "main",
        path: "skills/docx",
      });
    });

    it("parses nested directory URL", () => {
      const result = parseGitHubUrl(
        "https://github.com/vercel-labs/agent-skills/tree/main/skills/claude.ai/vercel-deploy"
      );

      expect(result).toEqual({
        type: "directory",
        owner: "vercel-labs",
        repo: "agent-skills",
        branch: "main",
        path: "skills/claude.ai/vercel-deploy",
      });
    });
  });

  describe("invalid URLs", () => {
    it("returns null for non-GitHub URLs", () => {
      const result = parseGitHubUrl("https://gitlab.com/owner/repo");

      expect(result).toBeNull();
    });

    it("returns null for incomplete URLs", () => {
      const result = parseGitHubUrl("https://github.com/owner");

      expect(result).toBeNull();
    });

    it("returns null for invalid URLs", () => {
      const result = parseGitHubUrl("not-a-url");

      expect(result).toBeNull();
    });
  });
});

describe("isDirectFileUrl", () => {
  it("returns true for direct SKILL.md URL", () => {
    expect(
      isDirectFileUrl("https://github.com/owner/repo/blob/main/skills/SKILL.md")
    ).toBe(true);
  });

  it("returns true for any .md file URL", () => {
    expect(
      isDirectFileUrl("https://github.com/owner/repo/blob/main/README.md")
    ).toBe(true);
  });

  it("returns true for directory URL (likely contains SKILL.md)", () => {
    expect(
      isDirectFileUrl(
        "https://github.com/anthropics/skills/tree/main/skills/docx"
      )
    ).toBe(true);
  });

  it("returns false for repo URL", () => {
    expect(isDirectFileUrl("https://github.com/owner/repo")).toBe(false);
  });

  it("returns false for non-.md file", () => {
    expect(
      isDirectFileUrl("https://github.com/owner/repo/blob/main/index.ts")
    ).toBe(false);
  });
});

describe("isRepoUrl", () => {
  it("returns true for repo URL", () => {
    expect(isRepoUrl("https://github.com/owner/repo")).toBe(true);
  });

  it("returns false for file URL", () => {
    expect(isRepoUrl("https://github.com/owner/repo/blob/main/SKILL.md")).toBe(
      false
    );
  });

  it("returns false for directory URL", () => {
    expect(isRepoUrl("https://github.com/owner/repo/tree/main/skills")).toBe(
      false
    );
  });
});
