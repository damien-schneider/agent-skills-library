"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuthClient } from "@/shared/lib/auth-client";

import { MarkdownContentCard } from "./markdown-content-card";
import {
  FrontmatterCard,
  SidebarCards,
  SkillHeader,
} from "./skill-detail-cards";

interface SkillDetailViewProps {
  skillId: Id<"skills">;
}

export function SkillDetailView({ skillId }: SkillDetailViewProps) {
  const { data: session } = useAuthClient.useSession();
  const skill = useQuery(api.skills.getWithUserVote, {
    id: skillId,
    userId: session?.user?.id,
  });
  const categories = useQuery(api.categories.list) ?? [];
  const isSaved = useQuery(
    api.savedSkills.isSaved,
    session?.user?.id ? { skillId, userId: session.user.id } : "skip"
  );
  const voteMutation = useMutation(api.votes.vote);
  const toggleSaveMutation = useMutation(api.savedSkills.toggle);

  const [copied, setCopied] = useState(false);
  const [copiedFrontmatter, setCopiedFrontmatter] = useState(false);

  if (!skill) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  const category = categories.find((c) => c.slug === skill.category);

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(skill.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFrontmatter = async () => {
    const frontmatter = `---
name: ${skill.name}
description: ${skill.description}
category: ${category?.name || skill.category}
author: ${skill.authorName}
tags: [${skill.tags.join(", ")}]
---`;
    await navigator.clipboard.writeText(frontmatter);
    setCopiedFrontmatter(true);
    setTimeout(() => setCopiedFrontmatter(false), 2000);
  };

  const handleVote = async (direction: "up" | "down") => {
    if (!session?.user?.id) {
      return;
    }
    await voteMutation({
      skillId: skill._id,
      userId: session.user.id,
      direction,
    });
  };

  const handleToggleSave = async () => {
    if (!session?.user?.id) {
      return;
    }
    const result = await toggleSaveMutation({
      skillId: skill._id,
      userId: session.user.id,
    });
    if (result.saved) {
      toast.success("Skill saved to your library");
    } else {
      toast.success("Skill removed from your library");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 pt-28 pb-20">
        <SkillHeader category={category} skill={skill} />

        <div className="grid grid-cols-12 gap-4">
          <FrontmatterCard
            category={category}
            copied={copiedFrontmatter}
            formatDate={formatDate}
            onCopy={handleCopyFrontmatter}
            skill={skill}
          />

          <SidebarCards
            handleVote={handleVote}
            isSaved={isSaved ?? false}
            onToggleSave={handleToggleSave}
            session={session}
            skill={skill}
          />

          <MarkdownContentCard
            copied={copied}
            onCopy={handleCopyMarkdown}
            skill={skill}
          />
        </div>
      </main>
    </div>
  );
}
