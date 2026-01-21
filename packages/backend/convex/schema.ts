import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    // Source provenance
    sourceUrl: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
  })
    .index("by_category", ["category"])
    .index("by_archived", ["isArchived"])
    .index("by_score", ["score"])
    .index("by_aiScore", ["aiScore.overall"])
    .index("by_category_score", ["category", "score"])
    .index("by_category_aiScore", ["category", "aiScore.overall"])
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
});
