import {
  type GenericMutationCtx,
  paginationOptsValidator,
} from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

// Validation constants
const SKILL_NAME_MIN_LENGTH = 3;
const SKILL_NAME_MAX_LENGTH = 100;
const SKILL_DESCRIPTION_MIN_LENGTH = 10;
const SKILL_DESCRIPTION_MAX_LENGTH = 500;
const SKILL_MARKDOWN_MIN_LENGTH = 50;
const SKILL_MARKDOWN_MAX_LENGTH = 50_000;
const SKILL_TAGS_MAX_COUNT = 10;
const SKILL_TAG_MAX_LENGTH = 30;

// Blocked word list for basic moderation (expandable)
const BLOCKED_PATTERNS = [
  /\b(spam|scam|phishing)\b/i,
  /<script\b[^>]*>/i,
  /javascript:/i,
  /on\w+\s*=/i,
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateSkillInput(args: {
  name: string;
  description: string;
  markdown: string;
  tags: string[];
  category?: string;
}): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (args.name.length < SKILL_NAME_MIN_LENGTH) {
    errors.push(
      `Name must be at least ${SKILL_NAME_MIN_LENGTH} characters long`
    );
  }
  if (args.name.length > SKILL_NAME_MAX_LENGTH) {
    errors.push(
      `Name must be at most ${SKILL_NAME_MAX_LENGTH} characters long`
    );
  }

  // Description validation
  if (args.description.length < SKILL_DESCRIPTION_MIN_LENGTH) {
    errors.push(
      `Description must be at least ${SKILL_DESCRIPTION_MIN_LENGTH} characters long`
    );
  }
  if (args.description.length > SKILL_DESCRIPTION_MAX_LENGTH) {
    errors.push(
      `Description must be at most ${SKILL_DESCRIPTION_MAX_LENGTH} characters long`
    );
  }

  // Markdown validation
  if (args.markdown.length < SKILL_MARKDOWN_MIN_LENGTH) {
    errors.push(
      `Content must be at least ${SKILL_MARKDOWN_MIN_LENGTH} characters long`
    );
  }
  if (args.markdown.length > SKILL_MARKDOWN_MAX_LENGTH) {
    errors.push(
      `Content must be at most ${SKILL_MARKDOWN_MAX_LENGTH} characters long`
    );
  }

  // Tags validation
  if (args.tags.length > SKILL_TAGS_MAX_COUNT) {
    errors.push(`Maximum ${SKILL_TAGS_MAX_COUNT} tags allowed`);
  }
  for (const tag of args.tags) {
    if (tag.length > SKILL_TAG_MAX_LENGTH) {
      errors.push(`Tag "${tag}" exceeds ${SKILL_TAG_MAX_LENGTH} characters`);
    }
  }

  // Content moderation (basic)
  const allContent = `${args.name} ${args.description} ${args.markdown}`;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(allContent)) {
      errors.push("Content contains prohibited patterns");
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a skill should be visible to public users.
 * Reported skills (moderationStatus === "pending") and hidden skills should not be visible.
 */
function isSkillVisible(skill: Doc<"skills">): boolean {
  return (
    !skill.isArchived &&
    skill.moderationStatus !== "hidden" &&
    skill.moderationStatus !== "pending"
  );
}

export const list = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let skills: Doc<"skills">[];

    if (args.search) {
      skills = await ctx.db
        .query("skills")
        .withSearchIndex("search_skills", (q) => {
          let searchQuery = q.search("name", args.search as string);
          if (args.category) {
            searchQuery = searchQuery.eq("category", args.category);
          }
          return searchQuery;
        })
        .collect();
    } else if (args.category) {
      skills = await ctx.db
        .query("skills")
        .withIndex("by_category", (q) =>
          q.eq("category", args.category as string)
        )
        .collect();
    } else {
      skills = await ctx.db.query("skills").collect();
    }

    const visibleSkills = skills.filter(isSkillVisible);

    const skillsWithVotes = await Promise.all(
      visibleSkills.map(async (skill) => {
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
        };
      })
    );

    return skillsWithVotes;
  },
});

export const get = query({
  args: {
    id: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.id);
    if (!(skill && isSkillVisible(skill))) {
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
    };
  },
});

export const getWithUserVote = query({
  args: {
    id: v.id("skills"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.id);
    if (!(skill && isSkillVisible(skill))) {
      return null;
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_skill", (q) => q.eq("skillId", skill._id))
      .collect();

    const voteCount = votes.reduce((acc, vote) => {
      return acc + (vote.direction === "up" ? 1 : -1);
    }, 0);

    let userVote: "up" | "down" | null = null;
    if (args.userId) {
      const existingVote = votes.find((v) => v.userId === args.userId);
      if (existingVote) {
        userVote = existingVote.direction;
      }
    }

    return {
      ...skill,
      votes: voteCount,
      userVote,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    authorId: v.optional(v.string()),
    authorName: v.string(),
    markdown: v.string(),
    tags: v.array(v.string()),
    color: v.string(),
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
    // GitHub namespace fields
    githubOwner: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    skillSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use "uncategorized" as default category for AI categorization later
    const category = args.category || "uncategorized";

    // Validate input (skip category validation since it's auto-assigned)
    const validation = validateSkillInput({
      name: args.name.trim(),
      description: args.description.trim(),
      markdown: args.markdown.trim(),
      tags: args.tags,
      category,
    });

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    // Check if category exists, if not use uncategorized
    let finalCategory = category;
    const categoryDoc = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", category))
      .first();

    if (!categoryDoc) {
      // Fallback to uncategorized if category doesn't exist
      finalCategory = "uncategorized";
    }

    const skillId = await ctx.db.insert("skills", {
      name: args.name.trim(),
      description: args.description.trim(),
      category: finalCategory,
      authorId: args.authorId ?? "anonymous",
      authorName: args.authorName.trim() || "Anonymous",
      markdown: args.markdown.trim(),
      tags: args.tags.map((t) => t.trim().toLowerCase()),
      color: args.color,
      aiScore: args.aiScore,
      score: 0,
      upvotes: 0,
      downvotes: 0,
      // Extended metadata
      version: args.version,
      license: args.license,
      compatibility: args.compatibility,
      allowedTools: args.allowedTools,
      sourceUrl: args.sourceUrl,
      sourcePath: args.sourcePath,
      githubOwner: args.githubOwner,
      githubRepo: args.githubRepo,
      skillSlug: args.skillSlug,
    });

    // Only update category count if it exists
    if (categoryDoc) {
      await updateCategoryCount(ctx, finalCategory, 1);
    }

    return skillId;
  },
});

export const update = mutation({
  args: {
    id: v.id("skills"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    markdown: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    color: v.optional(v.string()),
    aiScore: v.optional(
      v.object({
        overall: v.number(),
        clarity: v.number(),
        usefulness: v.number(),
        completeness: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existingSkill = await ctx.db.get(id);
    if (!existingSkill) {
      throw new Error("Skill not found");
    }

    if (updates.category && updates.category !== existingSkill.category) {
      await updateCategoryCount(ctx, existingSkill.category, -1);
      await updateCategoryCount(ctx, updates.category, 1);
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

export const listPaginated = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      category,
      search,
      sortBy: sortByArg,
      paginationOpts,
      userId,
    } = args;

    if (search) {
      const results = await ctx.db
        .query("skills")
        .withSearchIndex("search_skills", (q) => {
          let searchQ = q.search("name", search);
          if (category) {
            searchQ = searchQ.eq("category", category);
          }
          return searchQ;
        })
        .paginate(paginationOpts);

      return {
        ...results,
        page: await Promise.all(
          results.page.filter(isSkillVisible).map(async (skill) => {
            let userVote: "up" | "down" | null = null;
            if (userId) {
              const vote = await ctx.db
                .query("votes")
                .withIndex("by_skill_and_user", (q) =>
                  q.eq("skillId", skill._id).eq("userId", userId)
                )
                .first();
              userVote = vote?.direction ?? null;
            }

            return {
              ...skill,
              votes: skill.score ?? 0,
              upvotes: skill.upvotes ?? 0,
              downvotes: skill.downvotes ?? 0,
              userVote,
            };
          })
        ),
      };
    }

    const sortBy = sortByArg || "votes";
    const results = await (() => {
      if (category) {
        if (sortBy === "votes") {
          return ctx.db
            .query("skills")
            .withIndex("by_category_score", (idx) =>
              idx.eq("category", category)
            )
            .order("desc")
            .paginate(paginationOpts);
        }
        if (sortBy === "score") {
          return ctx.db
            .query("skills")
            .withIndex("by_category_aiScore", (idx) =>
              idx.eq("category", category)
            )
            .order("desc")
            .paginate(paginationOpts);
        }
        if (sortBy === "installs") {
          return ctx.db
            .query("skills")
            .withIndex("by_category", (idx) => idx.eq("category", category))
            .order("desc")
            .paginate(paginationOpts);
        }
        // For date sorting, use the by_category index (Convex auto-appends _creationTime)
        return ctx.db
          .query("skills")
          .withIndex("by_category", (idx) => idx.eq("category", category))
          .order("desc")
          .paginate(paginationOpts);
      }
      if (sortBy === "votes") {
        return ctx.db
          .query("skills")
          .withIndex("by_score")
          .order("desc")
          .paginate(paginationOpts);
      }
      if (sortBy === "score") {
        return ctx.db
          .query("skills")
          .withIndex("by_aiScore")
          .order("desc")
          .paginate(paginationOpts);
      }
      if (sortBy === "installs") {
        return ctx.db
          .query("skills")
          .withIndex("by_install_count")
          .order("desc")
          .paginate(paginationOpts);
      }
      if (sortBy === "trending") {
        return ctx.db
          .query("skills")
          .withIndex("by_weekly_installs")
          .order("desc")
          .paginate(paginationOpts);
      }
      // For date sorting without category, use default table scan (sorted by _creationTime)
      return ctx.db.query("skills").order("desc").paginate(paginationOpts);
    })();

    const enrichedPage = await Promise.all(
      results.page.filter(isSkillVisible).map(async (skill) => {
        let userVote: "up" | "down" | null = null;
        if (userId) {
          const vote = await ctx.db
            .query("votes")
            .withIndex("by_skill_and_user", (idx) =>
              idx.eq("skillId", skill._id).eq("userId", userId)
            )
            .first();
          userVote = vote?.direction ?? null;
        }

        return {
          ...skill,
          votes: skill.score ?? 0,
          upvotes: skill.upvotes ?? 0,
          downvotes: skill.downvotes ?? 0,
          userVote,
        };
      })
    );

    return { ...results, page: enrichedPage };
  },
});

export const remove = mutation({
  args: {
    id: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.id);
    if (!skill) {
      throw new Error("Skill not found");
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_skill", (q) => q.eq("skillId", args.id))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    await updateCategoryCount(ctx, skill.category, -1);

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const listArchived = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const archivedSkills = await ctx.db
      .query("skills")
      .withIndex("by_archived", (q) => q.eq("isArchived", true))
      .collect();

    return archivedSkills.map((skill) => ({
      ...skill,
      upvotes: skill.upvotes ?? 0,
      downvotes: skill.downvotes ?? 0,
    }));
  },
});

export const listByAuthor = query({
  args: {
    authorId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .collect();

    const visibleSkills = skills.filter(isSkillVisible);

    const enrichedSkills = await Promise.all(
      visibleSkills.map(async (skill) => {
        let userVote: "up" | "down" | null = null;
        if (args.userId) {
          const vote = await ctx.db
            .query("votes")
            .withIndex("by_skill_and_user", (q) =>
              q.eq("skillId", skill._id).eq("userId", args.userId as string)
            )
            .first();
          userVote = vote?.direction ?? null;
        }

        return {
          ...skill,
          votes: skill.score ?? 0,
          upvotes: skill.upvotes ?? 0,
          downvotes: skill.downvotes ?? 0,
          userVote,
        };
      })
    );

    return enrichedSkills;
  },
});

export const unarchive = mutation({
  args: {
    id: v.id("skills"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isArchived: false });
  },
});

export const archive = mutation({
  args: {
    id: v.id("skills"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isArchived: true });
  },
});

export const archiveLowScoreSkills = internalMutation({
  args: {},
  handler: async (ctx) => {
    const lowScoreSkills = await ctx.db
      .query("skills")
      .withIndex("by_score", (q) => q.lt("score", -10))
      .collect();

    for (const skill of lowScoreSkills) {
      await ctx.db.patch(skill._id, { isArchived: true });
    }
  },
});

export const incrementCopyCount = mutation({
  args: {
    id: v.id("skills"),
    userId: v.optional(v.string()),
    hashedIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.id);
    if (!skill) {
      throw new Error("Skill not found");
    }

    // Check if user/identifier has already copied this skill
    const existingCopyByUser = args.userId
      ? await ctx.db
          .query("skillCopies")
          .withIndex("by_skill_and_user", (q) =>
            q.eq("skillId", args.id).eq("userId", args.userId)
          )
          .first()
      : null;

    const existingCopyByIdentifier = args.hashedIdentifier
      ? await ctx.db
          .query("skillCopies")
          .withIndex("by_skill_and_identifier", (q) =>
            q
              .eq("skillId", args.id)
              .eq("hashedIdentifier", args.hashedIdentifier)
          )
          .first()
      : null;

    const existingCopy = existingCopyByUser ?? existingCopyByIdentifier;

    // If already copied, don't increment
    if (existingCopy) {
      return { success: true, alreadyCopied: true };
    }

    // Create copy record
    await ctx.db.insert("skillCopies", {
      skillId: args.id,
      userId: args.userId,
      hashedIdentifier: args.hashedIdentifier,
    });

    // Increment copy count
    const currentCount = skill.copyCount ?? 0;
    await ctx.db.patch(args.id, {
      copyCount: currentCount + 1,
    });

    return { success: true, alreadyCopied: false };
  },
});

export const getByNamespace = query({
  args: {
    githubOwner: v.string(),
    githubRepo: v.string(),
    skillSlug: v.string(),
    userId: v.optional(v.string()),
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

    if (!(skill && isSkillVisible(skill))) {
      return null;
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_skill", (q) => q.eq("skillId", skill._id))
      .collect();

    const voteCount = votes.reduce((acc, vote) => {
      return acc + (vote.direction === "up" ? 1 : -1);
    }, 0);

    let userVote: "up" | "down" | null = null;
    if (args.userId) {
      const existingVote = votes.find((v) => v.userId === args.userId);
      if (existingVote) {
        userVote = existingVote.direction;
      }
    }

    return {
      ...skill,
      votes: voteCount,
      userVote,
    };
  },
});

export const getByOwnerSlug = query({
  args: {
    githubOwner: v.string(),
    skillSlug: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query("skills")
      .withIndex("by_owner_slug", (q) =>
        q.eq("githubOwner", args.githubOwner).eq("skillSlug", args.skillSlug)
      )
      .first();

    if (!(skill && isSkillVisible(skill))) {
      return null;
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_skill", (q) => q.eq("skillId", skill._id))
      .collect();

    const voteCount = votes.reduce((acc, vote) => {
      return acc + (vote.direction === "up" ? 1 : -1);
    }, 0);

    let userVote: "up" | "down" | null = null;
    if (args.userId) {
      const existingVote = votes.find((v) => v.userId === args.userId);
      if (existingVote) {
        userVote = existingVote.direction;
      }
    }

    return {
      ...skill,
      votes: voteCount,
      userVote,
    };
  },
});

export const listByGithubOwner = query({
  args: {
    githubOwner: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_github_owner", (q) =>
        q.eq("githubOwner", args.githubOwner)
      )
      .collect();

    const visibleSkills = skills.filter(isSkillVisible);

    const enrichedSkills = await Promise.all(
      visibleSkills.map(async (skill) => {
        let userVote: "up" | "down" | null = null;
        if (args.userId) {
          const vote = await ctx.db
            .query("votes")
            .withIndex("by_skill_and_user", (q) =>
              q.eq("skillId", skill._id).eq("userId", args.userId as string)
            )
            .first();
          userVote = vote?.direction ?? null;
        }

        return {
          ...skill,
          votes: skill.score ?? 0,
          upvotes: skill.upvotes ?? 0,
          downvotes: skill.downvotes ?? 0,
          userVote,
        };
      })
    );

    return enrichedSkills;
  },
});

async function updateCategoryCount(
  ctx: GenericMutationCtx<DataModel>,
  categorySlug: string,
  delta: number
) {
  const category = await ctx.db
    .query("categories")
    .withIndex("by_slug", (q) => q.eq("slug", categorySlug))
    .first();

  if (category) {
    await ctx.db.patch(category._id, {
      skillCount: Math.max(0, category.skillCount + delta),
    });
  }
}
