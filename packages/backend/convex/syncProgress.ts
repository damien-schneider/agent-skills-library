import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

// Get the current sync progress for a specific sync type
export const get = query({
  args: { syncType: v.string() },
  handler: (ctx, args) => {
    return ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();
  },
});

// Initialize or reset sync progress
export const start = internalMutation({
  args: { syncType: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();

    const initialData = {
      syncType: args.syncType,
      status: "fetching" as const,
      currentPhase: "Fetching skills from skills.sh...",
      totalItems: 0,
      processedItems: 0,
      totalSkillsFetched: 0,
      uniqueReposFound: 0,
      reposCreated: 0,
      reposUpdated: 0,
      skillsCreated: 0,
      installCountsUpdated: 0,
      startedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...initialData,
        errorMessage: undefined,
        completedAt: undefined,
      });
      return existing._id;
    }

    return ctx.db.insert("syncProgress", initialData);
  },
});

// Update progress during fetch phase
export const updateFetchProgress = internalMutation({
  args: {
    syncType: v.string(),
    totalSkillsFetched: v.number(),
    uniqueReposFound: v.number(),
    currentPhase: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalSkillsFetched: args.totalSkillsFetched,
        uniqueReposFound: args.uniqueReposFound,
        currentPhase: args.currentPhase,
        status: "fetching",
      });
    }
  },
});

// Update progress during processing phase
export const updateProcessingProgress = internalMutation({
  args: {
    syncType: v.string(),
    currentPhase: v.string(),
    totalItems: v.number(),
    processedItems: v.number(),
    reposCreated: v.optional(v.number()),
    reposUpdated: v.optional(v.number()),
    skillsCreated: v.optional(v.number()),
    installCountsUpdated: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {
        currentPhase: args.currentPhase,
        totalItems: args.totalItems,
        processedItems: args.processedItems,
        status: "processing",
      };

      if (args.reposCreated !== undefined) {
        updates.reposCreated = args.reposCreated;
      }
      if (args.reposUpdated !== undefined) {
        updates.reposUpdated = args.reposUpdated;
      }
      if (args.skillsCreated !== undefined) {
        updates.skillsCreated = args.skillsCreated;
      }
      if (args.installCountsUpdated !== undefined) {
        updates.installCountsUpdated = args.installCountsUpdated;
      }

      await ctx.db.patch(existing._id, updates);
    }
  },
});

// Mark sync as completed
export const complete = internalMutation({
  args: {
    syncType: v.string(),
    totalSkillsFetched: v.number(),
    uniqueReposFound: v.number(),
    reposCreated: v.number(),
    reposUpdated: v.number(),
    skillsCreated: v.number(),
    installCountsUpdated: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "completed",
        currentPhase: "Sync completed successfully",
        totalSkillsFetched: args.totalSkillsFetched,
        uniqueReposFound: args.uniqueReposFound,
        reposCreated: args.reposCreated,
        reposUpdated: args.reposUpdated,
        skillsCreated: args.skillsCreated,
        installCountsUpdated: args.installCountsUpdated,
        completedAt: Date.now(),
      });
    }
  },
});

// Mark sync as failed
export const fail = internalMutation({
  args: {
    syncType: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "error",
        currentPhase: "Sync failed",
        errorMessage: args.errorMessage,
        completedAt: Date.now(),
      });
    }
  },
});

// Reset sync to idle state (for cleanup)
export const reset = mutation({
  args: { syncType: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("syncProgress")
      .withIndex("by_sync_type", (q) => q.eq("syncType", args.syncType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "idle",
        currentPhase: "Ready to sync",
        totalItems: 0,
        processedItems: 0,
        totalSkillsFetched: 0,
        uniqueReposFound: 0,
        reposCreated: 0,
        reposUpdated: 0,
        skillsCreated: 0,
        installCountsUpdated: 0,
        errorMessage: undefined,
        completedAt: undefined,
      });
    }
  },
});
