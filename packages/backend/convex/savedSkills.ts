import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const savedSkills = await ctx.db
      .query("savedSkills")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const skillsWithDetails = await Promise.all(
      savedSkills.map(async (saved) => {
        const skill = await ctx.db.get(saved.skillId);
        if (!skill) {
          return null;
        }

        const votes = await ctx.db
          .query("votes")
          .withIndex("by_skill", (q) => q.eq("skillId", skill._id))
          .collect();

        const voteCount = votes.reduce((acc, vote) => {
          return acc + (vote.direction === "up" ? 1 : -1);
        }, 0);

        return {
          ...skill,
          votes: voteCount,
          savedAt: saved._creationTime,
        };
      })
    );

    return skillsWithDetails.filter(Boolean);
  },
});

export const isSaved = query({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedSkills")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", args.skillId).eq("userId", args.userId)
      )
      .first();

    return !!existing;
  },
});

export const save = mutation({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    const existing = await ctx.db
      .query("savedSkills")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", args.skillId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("savedSkills", {
      skillId: args.skillId,
      userId: args.userId,
    });
  },
});

export const unsave = mutation({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedSkills")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", args.skillId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

export const toggle = mutation({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) {
      throw new Error("Skill not found");
    }

    const existing = await ctx.db
      .query("savedSkills")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", args.skillId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }

    await ctx.db.insert("savedSkills", {
      skillId: args.skillId,
      userId: args.userId,
    });

    return { saved: true };
  },
});
