import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { env } from "@skills-agent-library/env/web";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NamespaceSkillClientPage } from "./skill-page";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_NAME = "Agents Library";

// Top-level regex patterns for performance
const FILE_EXTENSION_REGEX = /\.(md|mdx|txt)$/i;
const SEPARATOR_REGEX = /[-_]/g;
const WORD_BOUNDARY_REGEX = /\b\w/g;

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(convexUrl);
}

function truncateDescription(text: string, maxLength = 155): string {
  if (text.length <= maxLength) {
    return text;
  }
  const truncated = text.slice(0, maxLength - 3).trim();
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    return `${truncated.slice(0, lastSpace)}...`;
  }
  return `${truncated}...`;
}

function formatSkillName(name: string): string {
  return name
    .replace(FILE_EXTENSION_REGEX, "")
    .replace(SEPARATOR_REGEX, " ")
    .replace(WORD_BOUNDARY_REGEX, (char) => char.toUpperCase())
    .trim();
}

interface NamespaceSkillPageProps {
  params: Promise<{ owner: string; repo: string; skill: string }>;
}

export async function generateMetadata({
  params,
}: NamespaceSkillPageProps): Promise<Metadata> {
  const { owner, repo, skill: skillSlug } = await params;

  try {
    const client = getConvexClient();
    const skill = await client.query(api.skills.getByNamespace, {
      githubOwner: owner,
      githubRepo: repo,
      skillSlug,
    });

    if (!skill) {
      return {
        title: "Skill Not Found",
        description: "The requested skill could not be found.",
        robots: { index: false, follow: true },
      };
    }

    const formattedName = formatSkillName(skill.name);
    const truncatedDescription = truncateDescription(skill.description);
    const skillUrl = `${SITE_URL}/${owner}/${repo}/${skillSlug}`;

    const keywords = [
      "AI agent skill",
      "agent capability",
      skill.category,
      ...skill.tags.slice(0, 5),
    ].filter(Boolean);

    return {
      title: formattedName,
      description: truncatedDescription,
      keywords,
      authors: [{ name: skill.authorName }],
      openGraph: {
        type: "article",
        url: skillUrl,
        title: `${formattedName} | ${SITE_NAME}`,
        description: truncatedDescription,
        siteName: SITE_NAME,
        images: [
          {
            url: "/og-image.png",
            width: 1200,
            height: 630,
            alt: `${formattedName} - AI Agent Skill`,
          },
        ],
        publishedTime: new Date(skill._creationTime).toISOString(),
        authors: [skill.authorName],
        tags: skill.tags,
      },
      twitter: {
        card: "summary_large_image",
        title: `${formattedName} | ${SITE_NAME}`,
        description: truncatedDescription,
        images: ["/og-image.png"],
      },
      alternates: {
        canonical: skillUrl,
      },
      other: {
        "article:author": skill.authorName,
        "article:section": skill.category,
        "article:tag": skill.tags.join(", "),
      },
    };
  } catch {
    return {
      title: "Skill",
      description: "View this AI agent skill on Agents Library.",
    };
  }
}

export default async function NamespaceSkillPage({
  params,
}: NamespaceSkillPageProps) {
  const { owner, repo, skill: skillSlug } = await params;

  const client = getConvexClient();
  const skill = await client.query(api.skills.getByNamespace, {
    githubOwner: owner,
    githubRepo: repo,
    skillSlug,
  });

  if (!skill) {
    notFound();
  }

  return <NamespaceSkillClientPage skillId={skill._id} />;
}
