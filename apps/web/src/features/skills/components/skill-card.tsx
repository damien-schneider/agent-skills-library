"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { SignInDialog } from "@/shared/components/ui/sign-in-dialog";
import { useAuthClient } from "@/shared/lib/auth-client";
import { cn, formatSkillName } from "@/shared/lib/utils";
import type { Category, Skill } from "../lib/types";

interface SkillCardProps {
  skill: Skill;
  index: number;
  categories: Category[];
}

export function SkillCard({ skill, index, categories }: SkillCardProps) {
  const { data: session } = useAuthClient.useSession();
  const vote = useMutation(api.votes.vote);
  const [isHovered, setIsHovered] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);

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

  const getVoteColor = () => {
    const netVotes = skill.upvotes - skill.downvotes;
    if (netVotes > 0) {
      return "text-emerald-500";
    }
    if (netVotes < 0) {
      return "text-rose-500";
    }
    return "text-muted-foreground/40";
  };

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="group relative w-full cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      layout
      layoutId={`skill-card-${skill._id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ aspectRatio: "280 / 240" }}
      transition={{
        duration: 0.5,
        delay: index * 0.04,
        ease: [0.22, 1, 0.36, 1],
        layout: { type: "spring", stiffness: 300, damping: 30 },
      }}
    >
      <Link href={`/skills/${skill._id}`} prefetch>
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-300 ease-out",
            isHovered && "scale-[1.02]"
          )}
        >
          <svg
            aria-label="Skill card background"
            className="absolute inset-0 h-full w-full"
            fill="none"
            role="img"
            style={{ overflow: "visible" }}
            viewBox="0 0 280 240"
          >
            <defs>
              <filter
                height="140%"
                id={`shadow-${skill._id}`}
                width="140%"
                x="-20%"
                y="-20%"
              >
                <feDropShadow
                  dx="0"
                  dy="2"
                  floodOpacity="0.03"
                  stdDeviation="8"
                />
                <feDropShadow
                  dx="0"
                  dy="8"
                  floodOpacity="0.05"
                  stdDeviation="20"
                />
              </filter>
            </defs>
            <path
              className={`transition-all duration-300 ${isHovered ? "fill-card" : "fill-card/80"}`}
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
              className={`transition-all duration-300 ${isHovered ? "stroke-border/40" : "stroke-border/20"}`}
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

          <div className="absolute inset-0 flex w-full flex-col p-6 pb-8">
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
                  "line-clamp-3 text-[13px] text-muted-foreground/90 leading-relaxed transition delay-50 duration-300 ease-out",
                  "translate-y-0 opacity-100",
                  "md:translate-y-4 md:opacity-0",
                  isHovered && "md:translate-y-0 md:opacity-100"
                )}
              >
                {skill.description}
              </p>
            </div>

            <span className="mt-auto translate-y-4 text-muted-foreground/60 text-xs opacity-0 transition delay-100 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
              by {skill.authorName}
            </span>
          </div>
        </div>
      </Link>

      <button
        aria-label="Upvote"
        className={cn(
          "absolute right-[21%] bottom-[1%] flex h-[28.5%] w-[18.5%] min-w-11 flex-col items-center justify-center gap-0.5 rounded-[18px] transition-all duration-200",
          "z-99 cursor-pointer rounded-t-lg shadow-black/3 shadow-xl active:scale-[0.96]",
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
          "absolute right-[1%] bottom-[1%] flex h-[28.5%] w-[18.5%] min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[18px] rounded-t-lg shadow-black/3 shadow-xl transition-all duration-200",
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

      <p
        className={cn(
          "justify-centertransition-opacity absolute top-5 right-5 flex items-center font-bold text-xs tracking-tighter delay-200 duration-200 ease-out",
          getVoteColor()
          // isHovered && (skill.upvotes > 0 || skill.downvotes > 0)
          //   ? "scale-100 opacity-100"
          //   : "scale-0 opacity-0"
        )}
      >
        {skill.upvotes - skill.downvotes > 0 ? "+" : ""}
        {skill.upvotes - skill.downvotes}
      </p>

      <SignInDialog
        description="You need to be signed in to vote on skills. Sign in or create an account to share your opinion."
        onOpenChange={setShowSignInDialog}
        open={showSignInDialog}
        title="Sign in to vote"
      />
    </motion.article>
  );
}
