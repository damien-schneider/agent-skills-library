import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { env } from "@skills-agent-library/env/web";
import { ConvexHttpClient } from "convex/browser";
import type { MetadataRoute } from "next";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const MAX_SITEMAP_SKILLS = 5000; // Limit to prevent hitting Convex limits

// Create a server-side Convex client for sitemap generation
function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return null;
  }
  return new ConvexHttpClient(convexUrl);
}

interface SitemapSkill {
  _id: string;
  _creationTime: number;
  githubOwner?: string;
  skillSlug?: string;
}

interface PaginatedResult {
  page: SitemapSkill[];
  continueCursor: string | null;
  isDone: boolean;
}

// Fetch all skills using pagination to avoid hitting read limits
async function fetchAllSkillsForSitemap(
  client: ConvexHttpClient
): Promise<SitemapSkill[]> {
  const allSkills: SitemapSkill[] = [];
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone && allSkills.length < MAX_SITEMAP_SKILLS) {
    const result: PaginatedResult = await client.query(
      api.skills.listForSitemap,
      {
        paginationOpts: {
          numItems: 500,
          cursor,
        },
      }
    );

    allSkills.push(...result.page);
    cursor = result.continueCursor;
    isDone = result.isDone;
  }

  return allSkills;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const currentDate = new Date();

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/skills/new`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/what-are-agent-skills`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/what-are-agent-skills/claude-code`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/what-are-agent-skills/openai-agents`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/what-are-agent-skills/cursor-ai`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/what-are-agent-skills/windsurf`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Try to fetch dynamic skill pages using pagination
  try {
    const client = getConvexClient();
    if (client) {
      const skills = await fetchAllSkillsForSitemap(client);

      const skillRoutes: MetadataRoute.Sitemap = skills.map((skill) => {
        // Use namespace URL if available, otherwise use ID-based URL
        const skillUrl =
          skill.githubOwner && skill.skillSlug
            ? `${SITE_URL}/s/${skill.githubOwner}/${skill.skillSlug}`
            : `${SITE_URL}/skills/${skill._id}`;

        return {
          url: skillUrl,
          lastModified: new Date(skill._creationTime),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      });

      return [...staticRoutes, ...skillRoutes];
    }
  } catch {
    // If fetching fails, return only static routes
  }

  return staticRoutes;
}
