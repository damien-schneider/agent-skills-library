import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";

import { mutation, query } from "./_generated/server";

export const vote = mutation({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { skillId, userId, direction } = args;
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", skillId).eq("userId", userId)
      )
      .first();

    if (!existingVote) {
      await ctx.db.insert("votes", { skillId, userId, direction });
      await updateSkillScore(ctx, skillId, {
        score: direction === "up" ? 1 : -1,
        upvotes: direction === "up" ? 1 : 0,
        downvotes: direction === "down" ? 1 : 0,
      });
      return { action: "created" as const, direction };
    }

    if (existingVote.direction === direction) {
      await ctx.db.delete(existingVote._id);
      await updateSkillScore(ctx, skillId, {
        score: direction === "up" ? -1 : 1,
        upvotes: direction === "up" ? -1 : 0,
        downvotes: direction === "down" ? -1 : 0,
      });
      return { action: "removed" as const };
    }

    await ctx.db.patch(existingVote._id, { direction });
    await updateSkillScore(ctx, skillId, {
      score: direction === "up" ? 2 : -2,
      upvotes: direction === "up" ? 1 : -1,
      downvotes: direction === "down" ? 1 : -1,
    });
    return { action: "changed" as const, direction };
  },
});

async function updateSkillScore(
  ctx: GenericMutationCtx<DataModel>,
  skillId: Id<"skills">,
  delta: { score: number; upvotes: number; downvotes: number }
) {
  const skill = await ctx.db.get(skillId);
  if (skill) {
    await ctx.db.patch(skillId, {
      score: (skill.score ?? 0) + delta.score,
      upvotes: (skill.upvotes ?? 0) + delta.upvotes,
      downvotes: (skill.downvotes ?? 0) + delta.downvotes,
    });
  }
}

export const getUserVote = query({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const vote = await ctx.db
      .query("votes")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", args.skillId).eq("userId", args.userId)
      )
      .first();

    return vote?.direction ?? null;
  },
});

export const getVoteCount = query({
  args: {
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .collect();

    return votes.reduce((acc, vote) => {
      return acc + (vote.direction === "up" ? 1 : -1);
    }, 0);
  },
});

export const removeVote = mutation({
  args: {
    skillId: v.id("skills"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_skill_and_user", (q) =>
        q.eq("skillId", args.skillId).eq("userId", args.userId)
      )
      .first();

    if (existingVote) {
      const direction = existingVote.direction;
      await ctx.db.delete(existingVote._id);
      await updateSkillScore(ctx, args.skillId, {
        score: direction === "up" ? -1 : 1,
        upvotes: direction === "up" ? -1 : 0,
        downvotes: direction === "down" ? -1 : 0,
      });
      return { success: true };
    }

    return { success: false };
  },
});
