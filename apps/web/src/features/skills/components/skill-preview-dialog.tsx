"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Sparkles,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Streamdown } from "streamdown";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { SignInDialog } from "@/shared/components/ui/sign-in-dialog";
import { useAuthClient } from "@/shared/lib/auth-client";
import { cn, formatSkillName } from "@/shared/lib/utils";
import { getSkillUrl } from "../lib/types";

interface SkillPreviewDialogProps {
  skillId: Id<"skills">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillPreviewDialog({
  skillId,
  open,
  onOpenChange,
}: SkillPreviewDialogProps) {
  const router = useRouter();
  const { data: session } = useAuthClient.useSession();

  const skill = useQuery(
    api.skills.getWithUserVote,
    open ? { id: skillId, userId: session?.user?.id } : "skip"
  );
  const categories = useQuery(api.categories.list) ?? [];
  const voteMutation = useMutation(api.votes.vote);

  const [copied, setCopied] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);

  const category = categories.find((c) => c.slug === skill?.category);

  const handleCopyMarkdown = async () => {
    if (!skill) {
      return;
    }
    await navigator.clipboard.writeText(skill.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVote = async (direction: "up" | "down") => {
    if (!session?.user?.id) {
      setShowSignInDialog(true);
      return;
    }
    if (!skill) {
      return;
    }
    await voteMutation({
      skillId: skill._id,
      userId: session.user.id,
      direction,
    });
  };

  const handleViewDetails = useCallback(() => {
    if (!skill) {
      return;
    }
    onOpenChange(false);
    router.push(getSkillUrl(skill) as Route);
  }, [onOpenChange, router, skill]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex h-[75vh] max-w-7xl flex-col overflow-hidden rounded-t-xl p-0"
        showCloseButton={false}
      >
        {skill ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex h-full min-h-0 flex-col"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex shrink-0 items-center justify-between border-border border-b bg-background/98 px-6 py-4">
              <div className="flex items-center gap-3">
                {category && (
                  <span
                    className="rounded-full px-3 py-1 font-medium text-xs"
                    style={{
                      backgroundColor: `${category.color}20`,
                      color: category.color,
                    }}
                  >
                    {category.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                  onClick={handleViewDetails}
                  type="button"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">View details</span>
                </button>
                <DialogClose className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground">
                  <X />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="p-6 pb-12">
                <div className="mb-6">
                  <DialogTitle
                    className="mb-2 text-2xl text-foreground leading-tight md:text-3xl"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {formatSkillName(skill.name)}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                    {skill.description}
                  </DialogDescription>
                </div>

                <div className="mb-6 flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <button
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,border-color,color]",
                        skill.userVote === "up"
                          ? "bg-emerald-500 text-white"
                          : "border border-border bg-card text-muted-foreground hover:border-emerald-200 hover:bg-emerald-500/10 hover:text-emerald-500"
                      )}
                      onClick={() => handleVote("up")}
                      type="button"
                    >
                      <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                    <span className="min-w-[2.5rem] text-center font-semibold text-foreground text-sm">
                      {skill.votes > 0 ? "+" : ""}
                      {skill.votes}
                    </span>
                    <button
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,border-color,color]",
                        skill.userVote === "down"
                          ? "bg-rose-500 text-white"
                          : "border border-border bg-card text-muted-foreground hover:border-rose-200 hover:bg-rose-500/10 hover:text-rose-500"
                      )}
                      onClick={() => handleVote("down")}
                      type="button"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                    </button>
                  </div>

                  {skill.aiScore && (
                    <div className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-3 py-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="font-semibold text-indigo-500 text-xs">
                        {skill.aiScore.overall}
                      </span>
                    </div>
                  )}

                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {skill.tags.slice(0, 3).map((tag) => (
                      <span
                        className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground text-xs"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                    {skill.tags.length > 3 && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground text-xs">
                        +{skill.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border">
                  <div className="flex items-center justify-between border-border border-b bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-border" />
                        <div className="h-2.5 w-2.5 rounded-full bg-border" />
                        <div className="h-2.5 w-2.5 rounded-full bg-border" />
                      </div>
                      <span className="font-medium text-muted-foreground/60 text-xs">
                        SKILL.md
                      </span>
                    </div>
                    <button
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:opacity-90"
                      onClick={handleCopyMarkdown}
                      type="button"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  <div
                    className="prose prose-sm prose-neutral dark:prose-invert max-w-none p-6"
                    style={{
                      background: `linear-gradient(135deg, ${skill.color}10 0%, transparent 50%)`,
                    }}
                  >
                    <Streamdown
                      components={{
                        code: (props) => {
                          const { children, className } = props;
                          const isInline = !className;
                          return isInline ? (
                            <code className="rounded bg-muted px-1 py-0.5 font-mono text-muted-foreground text-xs">
                              {children}
                            </code>
                          ) : (
                            <ScrollArea className="my-3 rounded-xl border border-border bg-muted">
                              <pre className="p-4 text-foreground">
                                <code className="font-mono text-xs">
                                  {children}
                                </code>
                              </pre>
                            </ScrollArea>
                          );
                        },
                        h1: (props) => (
                          <h2 className="mt-6 mb-3 font-bold text-foreground text-lg first:mt-0">
                            {props.children}
                          </h2>
                        ),
                        h2: (props) => (
                          <h3 className="mt-5 mb-2 font-semibold text-base text-foreground">
                            {props.children}
                          </h3>
                        ),
                        h3: (props) => (
                          <h4 className="mt-4 mb-2 font-medium text-foreground text-sm">
                            {props.children}
                          </h4>
                        ),
                        p: (props) => (
                          <p className="mb-3 text-muted-foreground/90 text-sm leading-relaxed">
                            {props.children}
                          </p>
                        ),
                        ul: (props) => (
                          <ul className="mb-3 ml-4 list-outside list-disc space-y-1.5 text-muted-foreground/90 text-sm">
                            {props.children}
                          </ul>
                        ),
                        ol: (props) => (
                          <ol className="mb-3 ml-4 list-outside list-decimal space-y-1.5 text-muted-foreground/90 text-sm">
                            {props.children}
                          </ol>
                        ),
                        li: (props) => (
                          <li className="text-muted-foreground/90 text-sm leading-relaxed">
                            {props.children}
                          </li>
                        ),
                        strong: (props) => (
                          <strong className="font-semibold text-foreground">
                            {props.children}
                          </strong>
                        ),
                        blockquote: (props) => (
                          <blockquote className="my-3 border-border border-l-4 pl-3 text-muted-foreground/70 text-sm italic">
                            {props.children}
                          </blockquote>
                        ),
                        table: (props) => (
                          <div className="my-3 overflow-x-auto">
                            <table className="min-w-full border-collapse border border-border">
                              {props.children}
                            </table>
                          </div>
                        ),
                        thead: (props) => (
                          <thead className="bg-muted">{props.children}</thead>
                        ),
                        tbody: (props) => <tbody>{props.children}</tbody>,
                        tr: (props) => (
                          <tr className="border-border border-b even:bg-muted/30">
                            {props.children}
                          </tr>
                        ),
                        th: (props) => (
                          <th className="border-border border-r border-b bg-muted px-3 py-1.5 text-left font-semibold text-foreground text-xs last:border-r-0">
                            {props.children}
                          </th>
                        ),
                        td: (props) => (
                          <td className="border-border border-r px-3 py-1.5 text-muted-foreground/90 text-xs last:border-r-0">
                            {props.children}
                          </td>
                        ),
                      }}
                    >
                      {skill.markdown}
                    </Streamdown>
                  </div>
                </div>

                <p className="mt-12 flex items-center justify-center border-border text-muted-foreground text-xs tracking-tight">
                  View the full page for more details and frontmatter
                </p>
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              className="h-8 w-8 rounded-full border-4 border-foreground/20 border-t-foreground"
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          </div>
        )}
      </DialogContent>

      <SignInDialog
        description="You need to be signed in to vote on skills. Sign in or create an account to get started."
        onOpenChange={setShowSignInDialog}
        open={showSignInDialog}
        title="Sign in to vote"
      />
    </Dialog>
  );
}
