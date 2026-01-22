import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Add New Skill",
  description:
    "Share your AI agent skill with the community. Import from GitHub, paste markdown content, or create a new skill from scratch.",
  openGraph: {
    title: "Add New Skill | Agents Library",
    description:
      "Share your AI agent skill with the community. Import from GitHub, paste markdown content, or create a new skill from scratch.",
  },
};

export default function NewSkillLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
