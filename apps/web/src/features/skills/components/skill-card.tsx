"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Flag,
  MoreHorizontal,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { SignInDialog } from "@/shared/components/ui/sign-in-dialog";
import { useAuthClient } from "@/shared/lib/auth-client";
import { cn, formatSkillName } from "@/shared/lib/utils";
import type { Category, Skill } from "../lib/types";
import { SkillPreviewDialog } from "./skill-preview-dialog";

interface SkillCardProps {
  skill: Skill;
  index: number;
  categories: Category[];
}

export function SkillCard({ skill, index, categories }: SkillCardProps) {
  const { data: session } = useAuthClient.useSession();
  const router = useRouter();
  const vote = useMutation(api.votes.vote);
  const toggleSave = useMutation(api.savedSkills.toggle);
  const [isHovered, setIsHovered] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [hasReportedLocal, setHasReportedLocal] = useState(false);

  const userId = session?.user?.id;
  const isSaved = useQuery(
    api.savedSkills.isSaved,
    userId ? { skillId: skill._id as Id<"skills">, userId } : "skip"
  );

  const category = categories.find((c) => c.slug === skill.category);

  const handleVote = async (e: React.MouseEvent, direction: "up" | "down") => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user?.id) {
      setShowSignInDialog(true);
      return;
    }

    await vote({
      skillId: skill._id,
      userId: session.user.id,
      direction,
    });
  };

  const handleSvgClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPreviewDialog(true);
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/authors/${skill.authorId}` as Route);
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) {
      setShowSignInDialog(true);
      return;
    }
    if (hasReportedLocal) {
      return;
    }
    // TODO: Replace with api.moderation.reportSkill once backend types are regenerated
    setHasReportedLocal(true);
    toast.success("Skill reported successfully");
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) {
      setShowSignInDialog(true);
      return;
    }
    try {
      const result = await toggleSave({
        skillId: skill._id as Id<"skills">,
        userId,
      });
      toast.success(result.saved ? "Saved to library" : "Removed from library");
    } catch {
      toast.error("Failed to update library");
    }
  };

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="group relative w-full"
      initial={{ opacity: 0, y: 20 }}
      layout="position"
      layoutId={`skill-card-${skill._id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        aspectRatio: "280 / 240",
      }}
      transition={{
        duration: 0.5,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1],
        layout: { type: "spring", stiffness: 300, damping: 30 },
      }}
    >
      <div
        className={cn(
          "absolute inset-0 transition-transform duration-300 ease-out will-change-transform",
          isHovered && "scale-[1.02]"
        )}
      >
        <button
          aria-label="View skill details"
          className="absolute inset-0 z-0 h-full w-full cursor-pointer border-0 bg-transparent p-0"
          onClick={handleSvgClick}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            fill="none"
            role="img"
            style={{ overflow: "visible" }}
            viewBox="0 0 280 240"
          >
            <defs>
              <filter
                height="130%"
                id={`shadow-${skill._id}`}
                width="130%"
                x="-15%"
                y="-10%"
              >
                <feDropShadow
                  dx="0"
                  dy="4"
                  floodOpacity="0.06"
                  stdDeviation="12"
                />
              </filter>
            </defs>
            <path
              className={`transition-colors duration-300 ${isHovered ? "fill-card" : "fill-card/80"}`}
              d="M24 2
                 H256
                 Q278 2 278 24
                 V152
                 Q278 164 266 164
                 H176
                 Q164 164 164 176
                 V216
                 Q164 238 142 238
                 H24
                 Q2 238 2 216
                 V24
                 Q2 2 24 2
                 Z"
              filter={`url(#shadow-${skill._id})`}
            />
            <path
              className={`transition-colors duration-300 ${isHovered ? "stroke-border/40" : "stroke-border/20"}`}
              d="M24 2
                 H256
                 Q278 2 278 24
                 V152
                 Q278 164 266 164
                 H176
                 Q164 164 164 176
                 V216
                 Q164 238 142 238
                 H24
                 Q2 238 2 216
                 V24
                 Q2 2 24 2
                 Z"
              fill="none"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        <button
          aria-label={isSaved ? "Remove from library" : "Save to library"}
          className={cn(
            "absolute top-5 right-[3.25rem] z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border/30 bg-card/90 text-muted-foreground backdrop-blur-sm transition-all duration-200",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-muted hover:text-foreground"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleSaveClick(e);
          }}
          type="button"
        >
          {isSaved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "absolute top-5 right-5 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border/30 bg-card/90 text-muted-foreground backdrop-blur-sm transition-all duration-200",
              "opacity-0 group-hover:opacity-100",
              "hover:bg-muted hover:text-foreground"
            )}
            onClick={(e) => e.stopPropagation()}
            render={<button aria-label="More options" type="button" />}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-xl border border-border/50 bg-card/95 shadow-lg backdrop-blur-sm"
          >
            <DropdownMenuItem onClick={handleAuthorClick}>
              <User className="mr-2 h-4 w-4" />
              Show author page
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={hasReportedLocal}
              onClick={handleReportClick}
            >
              <Flag className="mr-2 h-4 w-4" />
              {hasReportedLocal ? "Already reported" : "Report skill"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSaveClick}>
              {isSaved ? (
                <BookmarkCheck className="mr-2 h-4 w-4" />
              ) : (
                <Bookmark className="mr-2 h-4 w-4" />
              )}
              {isSaved ? "Saved" : "Save to library"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="pointer-events-none absolute inset-0 z-0 flex w-full flex-col p-6 pb-8">
          <h3 className="truncate pr-4 font-semibold text-[17px] text-foreground leading-snug">
            {formatSkillName(skill.name)}
          </h3>

          <div className={cn("mt-3 flex flex-1 flex-col")}>
            <span
              className="mb-2 self-start rounded-full px-2 py-0.5 font-medium text-[10px]"
              style={{
                backgroundColor: `${category?.color || "#6366f1"}25`,
                color: category?.color || "#6366f1",
              }}
            >
              {category?.name || skill.category}
            </span>

            <p
              className={cn(
                "line-clamp-3 transform-gpu text-[13px] text-muted-foreground/90 leading-relaxed transition delay-50 duration-300 ease-out",
                "translate-y-0 opacity-100",
                "md:translate-y-4 md:opacity-0",
                isHovered && "md:translate-y-0 md:opacity-100"
              )}
            >
              {skill.description}
            </p>
          </div>

          <span className="mt-auto translate-y-4 transform-gpu text-muted-foreground/60 text-xs opacity-0 transition delay-100 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            by {skill.authorName}
          </span>
        </div>
      </div>

      <button
        aria-label="Upvote"
        className={cn(
          "absolute right-[21%] bottom-[1%] z-10 flex h-[28.5%] w-[18.5%] min-w-11 flex-col items-center justify-center gap-0.5 rounded-[18px] transition-transform duration-200",
          "cursor-pointer rounded-t-lg shadow-black/3 shadow-xl active:scale-[0.96]",
          skill.userVote === "up"
            ? "bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg"
            : "border border-border/20 bg-card/80 text-muted-foreground/80 hover:border-emerald-500/10 hover:bg-emerald-500/10 hover:text-emerald-500"
        )}
        onClick={(e) => handleVote(e, "up")}
        type="button"
      >
        <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
        <span className="font-semibold text-xs">{skill.upvotes}</span>
      </button>

      <button
        aria-label="Downvote"
        className={cn(
          "absolute right-[1%] bottom-[1%] z-10 flex h-[28.5%] w-[18.5%] min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[18px] rounded-t-lg shadow-black/3 shadow-xl transition-transform duration-200",
          "rounded-tr-lg active:scale-[0.96]",
          skill.userVote === "down"
            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
            : "border border-border/20 bg-card/80 text-muted-foreground/80 hover:border-rose-500/10 hover:bg-rose-500/10 hover:text-rose-500"
        )}
        onClick={(e) => handleVote(e, "down")}
        type="button"
      >
        <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
        <span className="font-semibold text-xs">{skill.downvotes}</span>
      </button>

      <SignInDialog
        description="You need to be signed in to vote on skills. Sign in or create an account to share your opinion."
        onOpenChange={setShowSignInDialog}
        open={showSignInDialog}
        title="Sign in to vote"
      />

      <SkillPreviewDialog
        onOpenChange={setShowPreviewDialog}
        open={showPreviewDialog}
        skillId={skill._id as Id<"skills">}
      />
    </motion.article>
  );
}
