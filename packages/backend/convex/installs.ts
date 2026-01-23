import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { agentPlatforms } from "./schema";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const recordInstall = mutation({
  args: {
    skillId: v.id("skills"),
    agent: agentPlatforms,
    hashedIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("skillInstalls", {
      skillId: args.skillId,
      agent: args.agent,
      timestamp: now,
      hashedIdentifier: args.hashedIdentifier,
    });

    const skill = await ctx.db.get(args.skillId);
    if (skill) {
      await ctx.db.patch(args.skillId, {
        installCount: (skill.installCount ?? 0) + 1,
      });
    }

    const existingStat = await ctx.db
      .query("skillInstallStats")
      .withIndex("by_skill_and_agent", (q) =>
        q.eq("skillId", args.skillId).eq("agent", args.agent)
      )
      .unique();

    if (existingStat) {
      await ctx.db.patch(existingStat._id, {
        count: existingStat.count + 1,
      });
    } else {
      await ctx.db.insert("skillInstallStats", {
        skillId: args.skillId,
        agent: args.agent,
        count: 1,
      });
    }
  },
});

export const recordInstallByNamespace = mutation({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
    skillSlug: v.string(),
    agent: agentPlatforms,
    hashedIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query("skills")
      .withIndex("by_github_namespace", (q) =>
        q
          .eq("githubOwner", args.githubOwner)
          .eq("githubRepo", args.githubRepo)
          .eq("skillSlug", args.skillSlug)
      )
      .first();

    if (!skill) {
      return { success: false, error: "Skill not found" };
    }

    const now = Date.now();

    await ctx.db.insert("skillInstalls", {
      skillId: skill._id,
      agent: args.agent,
      timestamp: now,
      hashedIdentifier: args.hashedIdentifier,
    });

    await ctx.db.patch(skill._id, {
      installCount: (skill.installCount ?? 0) + 1,
    });

    const existingStat = await ctx.db
      .query("skillInstallStats")
      .withIndex("by_skill_and_agent", (q) =>
        q.eq("skillId", skill._id).eq("agent", args.agent)
      )
      .unique();

    if (existingStat) {
      await ctx.db.patch(existingStat._id, {
        count: existingStat.count + 1,
      });
    } else {
      await ctx.db.insert("skillInstallStats", {
        skillId: skill._id,
        agent: args.agent,
        count: 1,
      });
    }

    return { success: true, skillId: skill._id };
  },
});

export const getInstallStatsForSkill = query({
  args: { skillId: v.id("skills") },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("skillInstallStats")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .collect();

    const now = Date.now();
    const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;
    const sevenDaysAgo = now - SEVEN_DAYS_MS;

    const recentInstalls = await ctx.db
      .query("skillInstalls")
      .withIndex("by_skill_and_timestamp", (q) =>
        q.eq("skillId", args.skillId).gte("timestamp", sevenDaysAgo)
      )
      .collect();

    const last24h = recentInstalls.filter(
      (i) => i.timestamp >= twentyFourHoursAgo
    ).length;
    const last7d = recentInstalls.length;

    const byAgent = stats.reduce(
      (acc, stat) => {
        acc[stat.agent] = stat.count;
        return acc;
      },
      {} as Record<string, number>
    );

    const skill = await ctx.db.get(args.skillId);
    const totalInstalls = skill?.installCount ?? 0;

    return {
      totalInstalls,
      last24h,
      last7d,
      byAgent,
    };
  },
});

export const getTrendingSkills = query({
  args: {
    period: v.union(v.literal("24h"), v.literal("7d"), v.literal("all")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const now = Date.now();

    if (args.period === "all") {
      const skills = await ctx.db
        .query("skills")
        .withIndex("by_install_count")
        .order("desc")
        .filter((q) =>
          q.and(
            q.neq(q.field("isArchived"), true),
            q.neq(q.field("moderationStatus"), "hidden")
          )
        )
        .take(limit);

      return skills.map((skill) => ({
        ...skill,
        trendingInstalls: skill.installCount ?? 0,
      }));
    }

    const periodMs =
      args.period === "24h" ? TWENTY_FOUR_HOURS_MS : SEVEN_DAYS_MS;
    const cutoff = now - periodMs;

    const recentInstalls = await ctx.db
      .query("skillInstalls")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .collect();

    const installCounts = new Map<string, number>();
    for (const install of recentInstalls) {
      const skillId = install.skillId.toString();
      installCounts.set(skillId, (installCounts.get(skillId) ?? 0) + 1);
    }

    const sortedSkillIds = [...installCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const skills = await Promise.all(
      sortedSkillIds.map(async ([skillIdStr, count]) => {
        const allSkills = await ctx.db.query("skills").collect();
        const skill = allSkills.find((s) => s._id.toString() === skillIdStr);
        return skill ? { ...skill, trendingInstalls: count } : null;
      })
    );

    return skills.filter(
      (s) =>
        s !== null && s.isArchived !== true && s.moderationStatus !== "hidden"
    );
  },
});

export const getLeaderboard = query({
  args: {
    sortBy: v.union(
      v.literal("installs"),
      v.literal("trending"),
      v.literal("votes")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.sortBy === "votes") {
      return ctx.db
        .query("skills")
        .withIndex("by_score")
        .order("desc")
        .filter((q) =>
          q.and(
            q.neq(q.field("isArchived"), true),
            q.neq(q.field("moderationStatus"), "hidden")
          )
        )
        .take(limit);
    }

    if (args.sortBy === "installs") {
      return ctx.db
        .query("skills")
        .withIndex("by_install_count")
        .order("desc")
        .filter((q) =>
          q.and(
            q.neq(q.field("isArchived"), true),
            q.neq(q.field("moderationStatus"), "hidden")
          )
        )
        .take(limit);
    }

    const now = Date.now();
    const cutoff = now - TWENTY_FOUR_HOURS_MS;

    const recentInstalls = await ctx.db
      .query("skillInstalls")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .collect();

    const installCounts = new Map<string, number>();
    for (const install of recentInstalls) {
      const skillId = install.skillId.toString();
      installCounts.set(skillId, (installCounts.get(skillId) ?? 0) + 1);
    }

    const sortedSkillIds = [...installCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const skills = await Promise.all(
      sortedSkillIds.map(async ([skillIdStr, count]) => {
        const allSkills = await ctx.db.query("skills").collect();
        const skill = allSkills.find((s) => s._id.toString() === skillIdStr);
        return skill ? { ...skill, trendingInstalls: count } : null;
      })
    );

    return skills.filter(
      (s) =>
        s !== null && s.isArchived !== true && s.moderationStatus !== "hidden"
    );
  },
});
