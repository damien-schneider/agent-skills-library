"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { isAdminUser } from "@/features/skills";
import { InstallSkillDialog } from "@/features/skills/install/install-skill-dialog";
import { SignInDialog } from "@/shared/components/ui/sign-in-dialog";
import { useAuthClient } from "@/shared/lib/auth-client";
import { getHashedIdentifier } from "@/shared/lib/utils";

import { MarkdownContentCard } from "./markdown-content-card";
import {
  FrontmatterCard,
  InstallCommandCard,
  InstallStatsCard,
  RepositoryCard,
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
  const installStats = useQuery(api.installs.getInstallStatsForSkill, {
    skillId,
  });
  const voteMutation = useMutation(api.votes.vote);
  const toggleSaveMutation = useMutation(api.savedSkills.toggle);
  const incrementCopyCountMutation = useMutation(api.skills.incrementCopyCount);

  const [copied, setCopied] = useState(false);
  const [copiedFrontmatter, setCopiedFrontmatter] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);

  const userEmail = session?.user?.email;
  const isAdmin = isAdminUser(userEmail);

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
    try {
      const userId = session?.user?.id;
      const hashedIdentifier = userId ? undefined : await getHashedIdentifier();
      await incrementCopyCountMutation({
        id: skill._id,
        userId,
        hashedIdentifier: hashedIdentifier ?? undefined,
      });
    } catch {
      // Silently fail if copy count increment fails
    }
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
    try {
      const userId = session?.user?.id;
      const hashedIdentifier = userId ? undefined : await getHashedIdentifier();
      await incrementCopyCountMutation({
        id: skill._id,
        userId,
        hashedIdentifier: hashedIdentifier ?? undefined,
      });
    } catch {
      // Silently fail if copy count increment fails
    }
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
      setShowSignInDialog(true);
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
    <div className="relative min-h-screen">
      <button
        className={`fixed top-28 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-xl transition-[transform,background-color,border-color,color,box-shadow] duration-200 hover:scale-105 active:scale-95 ${
          isSaved
            ? "bg-amber-500 text-white shadow-amber-500/20 shadow-lg"
            : "border border-border bg-card text-muted-foreground hover:border-amber-200 hover:bg-amber-500/10 hover:text-amber-500"
        }`}
        onClick={handleToggleSave}
        title={isSaved ? "Remove from library" : "Save to library"}
        type="button"
      >
        {isSaved ? (
          <BookmarkCheck className="h-5 w-5" />
        ) : (
          <Bookmark className="h-5 w-5" />
        )}
      </button>

      <main className="mx-auto max-w-4xl px-6 pt-28 pb-20">
        <SkillHeader
          category={category}
          copyCount={skill.copyCount}
          isAdmin={isAdmin}
          skill={skill}
        />

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
            session={session}
            skill={skill}
          />

          <InstallCommandCard skill={skill} />

          {installStats && (
            <InstallStatsCard
              byAgent={installStats.byAgent}
              totalInstalls={installStats.totalInstalls}
              weeklyInstalls={installStats.last7d}
            />
          )}

          {skill.githubOwner && skill.githubRepo && (
            <RepositoryCard
              githubOwner={skill.githubOwner}
              githubRepo={skill.githubRepo}
              githubStarsCached={skill.githubStarsCached}
            />
          )}

          <MarkdownContentCard
            copied={copied}
            onCopy={handleCopyMarkdown}
            onInstallClick={() => setShowInstallDialog(true)}
            skill={skill}
          />
        </div>

        <InstallSkillDialog
          hasBundle={false}
          onOpenChange={setShowInstallDialog}
          open={showInstallDialog}
          skillContent={skill.markdown}
          skillName={skill.name}
          sourceUrl={skill.sourceUrl}
        />

        <SignInDialog
          description="You need to be signed in to save skills. Sign in or create an account to get started."
          onOpenChange={setShowSignInDialog}
          open={showSignInDialog}
          title="Sign in to continue"
        />
      </main>
    </div>
  );
}
