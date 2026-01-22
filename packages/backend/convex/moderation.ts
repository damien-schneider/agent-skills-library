import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const reportSkill = mutation({
  args: {
    skillId: v.id("skills"),
    reporterId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    const existingReport = await ctx.db
      .query("skillReports")
      .withIndex("by_skill_and_reporter", (q) =>
        q.eq("skillId", args.skillId).eq("reporterId", args.reporterId)
      )
      .first();

    if (existingReport) {
      throw new Error("You have already reported this skill");
    }

    await ctx.db.insert("skillReports", {
      skillId: args.skillId,
      reporterId: args.reporterId,
      reason: args.reason.trim(),
      status: "pending",
    });

    const newReportCount = (skill.reportCount ?? 0) + 1;
    await ctx.db.patch(args.skillId, {
      reportCount: newReportCount,
      moderationStatus:
        newReportCount >= 3 ? "pending" : (skill.moderationStatus ?? "visible"),
    });

    return { success: true };
  },
});

export const listReportedSkills = query({
  args: {},
  handler: async (ctx) => {
    const pendingReports = await ctx.db
      .query("skillReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const skillIds = [...new Set(pendingReports.map((r) => r.skillId))];

    const skillsWithReports = await Promise.all(
      skillIds.map(async (skillId) => {
        const skill = await ctx.db.get(skillId);
        if (!skill) {
          return null;
        }

        const reports = pendingReports.filter((r) => r.skillId === skillId);

        return {
          ...skill,
          upvotes: skill.upvotes ?? 0,
          downvotes: skill.downvotes ?? 0,
          reports: reports.map((r) => ({
            _id: r._id,
            reason: r.reason,
            reporterId: r.reporterId,
            _creationTime: r._creationTime,
          })),
        };
      })
    );

    return skillsWithReports.filter(Boolean);
  },
});

export const hideSkill = mutation({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    await ctx.db.patch(args.skillId, {
      moderationStatus: "hidden",
    });

    const reports = await ctx.db
      .query("skillReports")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .collect();

    for (const report of reports) {
      if (report.status === "pending") {
        await ctx.db.patch(report._id, { status: "reviewed" });
      }
    }

    return { success: true };
  },
});

export const dismissReports = mutation({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    await ctx.db.patch(args.skillId, {
      moderationStatus: "visible",
      reportCount: 0,
    });

    const reports = await ctx.db
      .query("skillReports")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .collect();

    for (const report of reports) {
      if (report.status === "pending") {
        await ctx.db.patch(report._id, { status: "dismissed" });
      }
    }

    return { success: true };
  },
});

export const unhideSkill = mutation({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    await ctx.db.patch(args.skillId, {
      moderationStatus: "visible",
    });

    return { success: true };
  },
});

export const hasReported = query({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingReport = await ctx.db
      .query("skillReports")
      .withIndex("by_skill_and_reporter", (q) =>
        q.eq("skillId", args.skillId).eq("reporterId", args.userId)
      )
      .first();

    return !!existingReport;
  },
});
