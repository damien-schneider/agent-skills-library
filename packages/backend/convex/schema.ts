import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Supported AI agent platforms for install tracking
export const agentPlatforms = v.union(
  v.literal("claude-code"),
  v.literal("cursor"),
  v.literal("windsurf"),
  v.literal("opencode"),
  v.literal("gemini-cli"),
  v.literal("antigravity"),
  v.literal("codex"),
  v.literal("github-copilot"),
  v.literal("amp"),
  v.literal("goose"),
  v.literal("kilo"),
  v.literal("kiro-cli"),
  v.literal("roo"),
  v.literal("trae"),
  v.literal("clawdbot"),
  v.literal("droid"),
  v.literal("unknown")
);

export default defineSchema({
  skills: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    authorId: v.string(),
    authorName: v.string(),
    markdown: v.string(),
    tags: v.array(v.string()),
    color: v.string(),
    isArchived: v.optional(v.boolean()),
    score: v.optional(v.number()), // denormalized net vote count
    upvotes: v.optional(v.number()),
    downvotes: v.optional(v.number()),
    aiScore: v.optional(
      v.object({
        overall: v.number(),
        clarity: v.number(),
        usefulness: v.number(),
        completeness: v.number(),
      })
    ),
    // Extended metadata fields per Agent Skills spec
    version: v.optional(v.string()),
    license: v.optional(v.string()),
    compatibility: v.optional(v.string()),
    allowedTools: v.optional(v.array(v.string())),
    // Source provenance (legacy)
    sourceUrl: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
    // GitHub namespace structure (owner/repo/skill-name format like skills.sh)
    githubOwner: v.optional(v.string()), // e.g., "anthropics", "expo", "vercel-labs"
    githubRepo: v.optional(v.string()), // e.g., "skills", "agent-skills"
    skillSlug: v.optional(v.string()), // e.g., "skill-creator", "building-native-ui"
    // Official/verified source tracking
    isOfficialSource: v.optional(v.boolean()), // true if from a verified official repo
    officialRepoId: v.optional(v.id("officialRepos")), // link to officialRepos table
    // Moderation fields
    moderationStatus: v.optional(
      v.union(v.literal("visible"), v.literal("hidden"), v.literal("pending"))
    ),
    reportCount: v.optional(v.number()),
    // Analytics - denormalized for fast queries
    copyCount: v.optional(v.number()),
    installCount: v.optional(v.number()),
    weeklyInstalls: v.optional(v.number()),
    githubStarsCached: v.optional(v.number()),
    githubStarsCachedAt: v.optional(v.number()),
  })
    .index("by_category", ["category"])
    .index("by_authorId", ["authorId"])
    .index("by_moderation_status", ["moderationStatus"])
    .index("by_archived", ["isArchived"])
    .index("by_score", ["score"])
    .index("by_aiScore", ["aiScore.overall"])
    .index("by_category_score", ["category", "score"])
    .index("by_category_aiScore", ["category", "aiScore.overall"])
    // New indexes for namespace lookups and leaderboards
    .index("by_github_namespace", ["githubOwner", "githubRepo", "skillSlug"])
    .index("by_github_owner", ["githubOwner"])
    .index("by_official_repo", ["officialRepoId"])
    .index("by_install_count", ["installCount"])
    .index("by_weekly_installs", ["weeklyInstalls"])
    .searchIndex("search_skills", {
      searchField: "name",
      filterFields: ["category"],
    })
    .searchIndex("search_skills_full", {
      searchField: "description",
      filterFields: ["category"],
    }),

  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    color: v.string(),
    skillCount: v.number(),
  }).index("by_slug", ["slug"]),

  votes: defineTable({
    skillId: v.id("skills"),
    userId: v.string(),
    direction: v.union(v.literal("up"), v.literal("down")),
  })
    .index("by_skill", ["skillId"])
    .index("by_skill_and_user", ["skillId", "userId"]),

  savedSkills: defineTable({
    skillId: v.id("skills"),
    userId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_skill_and_user", ["skillId", "userId"]),

  skillReports: defineTable({
    skillId: v.id("skills"),
    reporterId: v.string(),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("dismissed")
    ),
  })
    .index("by_skill", ["skillId"])
    .index("by_status", ["status"])
    .index("by_skill_and_reporter", ["skillId", "reporterId"]),

  skillCopies: defineTable({
    skillId: v.id("skills"),
    userId: v.optional(v.string()),
    hashedIdentifier: v.optional(v.string()),
  })
    .index("by_skill", ["skillId"])
    .index("by_skill_and_user", ["skillId", "userId"])
    .index("by_skill_and_identifier", ["skillId", "hashedIdentifier"]),

  officialRepos: defineTable({
    githubOwner: v.string(),
    githubRepo: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isVerified: v.boolean(),
    skillCount: v.optional(v.number()),
    totalInstalls: v.optional(v.number()),
  })
    .index("by_github_namespace", ["githubOwner", "githubRepo"])
    .index("by_owner", ["githubOwner"]),

  skillInstalls: defineTable({
    skillId: v.id("skills"),
    agent: agentPlatforms,
    timestamp: v.number(),
    hashedIdentifier: v.optional(v.string()),
  })
    .index("by_skill", ["skillId"])
    .index("by_skill_and_timestamp", ["skillId", "timestamp"])
    .index("by_timestamp", ["timestamp"])
    .index("by_skill_and_agent", ["skillId", "agent"]),

  skillInstallStats: defineTable({
    skillId: v.id("skills"),
    agent: agentPlatforms,
    count: v.number(),
  })
    .index("by_skill", ["skillId"])
    .index("by_skill_and_agent", ["skillId", "agent"]),
});
