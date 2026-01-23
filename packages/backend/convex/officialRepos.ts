import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: (ctx) => {
    return ctx.db.query("officialRepos").collect();
  },
});

export const getById = query({
  args: { id: v.id("officialRepos") },
  handler: (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const getByNamespace = query({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
  },
  handler: (ctx, args) => {
    return ctx.db
      .query("officialRepos")
      .withIndex("by_github_namespace", (q) =>
        q.eq("githubOwner", args.githubOwner).eq("githubRepo", args.githubRepo)
      )
      .unique();
  },
});

export const getByOwner = query({
  args: { githubOwner: v.string() },
  handler: (ctx, args) => {
    return ctx.db
      .query("officialRepos")
      .withIndex("by_owner", (q) => q.eq("githubOwner", args.githubOwner))
      .collect();
  },
});

export const create = mutation({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officialRepos")
      .withIndex("by_github_namespace", (q) =>
        q.eq("githubOwner", args.githubOwner).eq("githubRepo", args.githubRepo)
      )
      .unique();

    if (existing) {
      throw new Error(
        `Official repo ${args.githubOwner}/${args.githubRepo} already exists`
      );
    }

    return ctx.db.insert("officialRepos", {
      ...args,
      isVerified: true,
      skillCount: 0,
      totalInstalls: 0,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("officialRepos"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
  },
  handler: (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    return ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("officialRepos") },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_official_repo", (q) => q.eq("officialRepoId", args.id))
      .collect();

    for (const skill of skills) {
      await ctx.db.patch(skill._id, {
        isOfficialSource: false,
        officialRepoId: undefined,
      });
    }

    return ctx.db.delete(args.id);
  },
});

export const updateSkillCount = mutation({
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

    return ctx.db.patch(args.id, {
      skillCount: skills.length,
      totalInstalls,
    });
  },
});

export const getSkillsForRepo = query({
  args: { id: v.id("officialRepos") },
  handler: (ctx, args) => {
    return ctx.db
      .query("skills")
      .withIndex("by_official_repo", (q) => q.eq("officialRepoId", args.id))
      .filter((q) =>
        q.and(
          q.neq(q.field("isArchived"), true),
          q.neq(q.field("moderationStatus"), "hidden")
        )
      )
      .collect();
  },
});

interface SeedResult {
  githubOwner: string;
  githubRepo: string;
  displayName: string;
  id: string;
  status: "created" | "exists";
}

export const seedOfficialRepos = mutation({
  args: {},
  handler: async (ctx) => {
    const officialRepos = [
      {
        githubOwner: "anthropics",
        githubRepo: "skills",
        displayName: "Anthropic Skills",
        description: "Official skills from Anthropic",
        websiteUrl: "https://anthropic.com",
      },
      {
        githubOwner: "expo",
        githubRepo: "skills",
        displayName: "Expo Skills",
        description: "Official skills for Expo and React Native development",
        websiteUrl: "https://expo.dev",
      },
      {
        githubOwner: "vercel-labs",
        githubRepo: "agent-skills",
        displayName: "Vercel Labs Agent Skills",
        description: "Official skills from Vercel Labs",
        websiteUrl: "https://vercel.com",
      },
      {
        githubOwner: "better-auth",
        githubRepo: "skills",
        displayName: "Better Auth Skills",
        description: "Authentication skills for Better Auth",
        websiteUrl: "https://better-auth.com",
      },
      {
        githubOwner: "supabase",
        githubRepo: "agent-skills",
        displayName: "Supabase Agent Skills",
        description: "Official skills for Supabase",
        websiteUrl: "https://supabase.com",
      },
      {
        githubOwner: "stripe",
        githubRepo: "ai",
        displayName: "Stripe AI Skills",
        description: "Official AI skills from Stripe",
        websiteUrl: "https://stripe.com",
      },
    ];

    const results: SeedResult[] = [];

    for (const repo of officialRepos) {
      const existing = await ctx.db
        .query("officialRepos")
        .withIndex("by_github_namespace", (q) =>
          q
            .eq("githubOwner", repo.githubOwner)
            .eq("githubRepo", repo.githubRepo)
        )
        .unique();

      if (existing) {
        results.push({
          ...repo,
          id: existing._id.toString(),
          status: "exists",
        });
      } else {
        const id = await ctx.db.insert("officialRepos", {
          ...repo,
          isVerified: true,
          skillCount: 0,
          totalInstalls: 0,
        });
        results.push({ ...repo, id: id.toString(), status: "created" });
      }
    }

    return results;
  },
});
