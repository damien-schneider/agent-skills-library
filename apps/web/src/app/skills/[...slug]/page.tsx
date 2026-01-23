import { api } from "@skills-agent-library/backend/convex/_generated/api";
import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import { env } from "@skills-agent-library/env/web";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkillClientPage } from "./skill-page";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_NAME = "Agents Library";

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

interface SkillPageProps {
  params: Promise<{ slug: string[] }>;
}

async function getSkillById(id: string) {
  const client = getConvexClient();
  return client.query(api.skills.get, { id: id as Id<"skills"> });
}

async function getSkillByOwnerAndSlug(owner: string, skillSlug: string) {
  const client = getConvexClient();
  return client.query(api.skills.getByOwnerSlug, {
    githubOwner: owner,
    skillSlug,
  });
}

async function getSkillBySlug(slug: string[]) {
  if (slug.length === 1) {
    return getSkillById(slug[0]);
  }

  if (slug.length === 2) {
    return getSkillByOwnerAndSlug(slug[0], slug[1]);
  }

  return null;
}

export async function generateMetadata({
  params,
}: SkillPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug.length === 0 || slug.length > 2) {
    return {
      title: "Skill Not Found",
      description: "The requested skill could not be found.",
      robots: { index: false, follow: true },
    };
  }

  try {
    const skill = await getSkillBySlug(slug);

    if (!skill) {
      return {
        title: "Skill Not Found",
        description: "The requested skill could not be found.",
        robots: { index: false, follow: true },
      };
    }

    const formattedName = formatSkillName(skill.name);
    const truncatedDescription = truncateDescription(skill.description);
    const skillUrl =
      slug.length === 2
        ? `${SITE_URL}/skills/${slug[0]}/${slug[1]}`
        : `${SITE_URL}/skills/${slug[0]}`;

    const authorName =
      slug.length === 2 ? slug[0] : (skill.authorName ?? "Unknown");

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
      authors: [{ name: authorName }],
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
        authors: [authorName],
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
        "article:author": authorName,
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

export default async function SkillPage({ params }: SkillPageProps) {
  const { slug } = await params;

  if (slug.length === 0 || slug.length > 2) {
    notFound();
  }

  const skill = await getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  return <SkillClientPage skillId={skill._id} />;
}
