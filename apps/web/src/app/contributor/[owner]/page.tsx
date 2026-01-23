import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { env } from "@skills-agent-library/env/web";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";

import { ContributorClientPage } from "./contributor-page";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
const SITE_NAME = "Agents Library";

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(convexUrl);
}

interface ContributorPageProps {
  params: Promise<{ owner: string }>;
}

export async function generateMetadata({
  params,
}: ContributorPageProps): Promise<Metadata> {
  const { owner } = await params;

  try {
    const client = getConvexClient();
    const skills = await client.query(api.skills.listByGithubOwner, {
      githubOwner: owner,
    });

    const skillCount = skills.length;
    const contributorUrl = `${SITE_URL}/contributor/${owner}`;

    return {
      title: `${owner} - Contributor`,
      description: `View ${skillCount} skill${skillCount !== 1 ? "s" : ""} contributed by ${owner} on ${SITE_NAME}.`,
      openGraph: {
        type: "profile",
        url: contributorUrl,
        title: `${owner} | ${SITE_NAME}`,
        description: `View ${skillCount} skill${skillCount !== 1 ? "s" : ""} contributed by ${owner}.`,
        siteName: SITE_NAME,
        images: [
          {
            url: "/og-image.png",
            width: 1200,
            height: 630,
            alt: `${owner} - Contributor Profile`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${owner} | ${SITE_NAME}`,
        description: `View ${skillCount} skill${skillCount !== 1 ? "s" : ""} contributed by ${owner}.`,
        images: ["/og-image.png"],
      },
      alternates: {
        canonical: contributorUrl,
      },
    };
  } catch {
    return {
      title: `${owner} - Contributor`,
      description: `View skills contributed by ${owner} on ${SITE_NAME}.`,
    };
  }
}

export default async function ContributorPage({
  params,
}: ContributorPageProps) {
  const { owner } = await params;
  return <ContributorClientPage owner={owner} />;
}
