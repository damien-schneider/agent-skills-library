"use client";

import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Github,
  Sparkles,
  Star,
  Terminal,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { SignInDialog } from "@/shared/components/ui/sign-in-dialog";
import { formatSkillName } from "@/shared/lib/utils";
import {
  type AgentPlatform,
  agentPlatformLabels,
  formatInstallCount,
  getGithubRepoUrl,
  getSkillInstallCommand,
} from "../lib/types";

interface SkillHeaderProps {
  skill: { name: string; description: string };
  category?: { name: string; color: string; skillCount: number };
  copyCount?: number;
  isAdmin?: boolean;
}

export function SkillHeader({
  skill,
  category,
  copyCount,
  isAdmin,
}: SkillHeaderProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mb-16 text-center"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
        initial={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: `${category?.color}20`,
          color: category?.color,
        }}
        transition={{ delay: 0.1 }}
      >
        <span className="font-semibold text-sm">{category?.name}</span>
        <span className="text-xs opacity-70">
          ({category?.skillCount ?? 1} skills)
        </span>
        {isAdmin && copyCount !== undefined && (
          <span className="text-xs opacity-70">
            • {copyCount} {copyCount === 1 ? "copy" : "copies"}
          </span>
        )}
      </motion.div>

      <h1
        className="mb-4 text-balance text-4xl text-foreground leading-tight md:text-5xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {formatSkillName(skill.name)}
      </h1>

      <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
        {skill.description}
      </p>
    </motion.div>
  );
}

interface FrontmatterCardProps {
  skill: {
    name: string;
    description: string;
    authorName: string;
    tags: string[];
    _creationTime: number;
  };
  category?: { name: string };
  copied: boolean;
  onCopy: () => void;
  formatDate: (timestamp: number) => string;
}

export function FrontmatterCard({
  skill,
  category,
  copied,
  onCopy,
  formatDate,
}: FrontmatterCardProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="relative col-span-12 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl shadow-black/5 lg:col-span-8"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.15 }}
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold text-muted-foreground/60 text-sm uppercase tracking-wider">
          Frontmatter
        </h2>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted/80 hover:text-foreground active:scale-95"
          onClick={onCopy}
          type="button"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="space-y-2 rounded-2xl bg-muted/50 p-5 font-mono text-sm">
        <div className="text-muted-foreground/40">---</div>
        <div>
          <span className="text-primary">name:</span>{" "}
          <span className="text-foreground">{formatSkillName(skill.name)}</span>
        </div>
        <div>
          <span className="text-primary">description:</span>{" "}
          <span className="text-foreground">{skill.description}</span>
        </div>
        <div>
          <span className="text-primary">category:</span>{" "}
          <span className="text-foreground">{category?.name}</span>
        </div>
        <div>
          <span className="text-primary">author:</span>{" "}
          <span className="text-foreground">{skill.authorName}</span>
        </div>
        <div>
          <span className="text-primary">tags:</span>{" "}
          <span className="text-foreground">
            [
            {skill.tags.map((t, i) => (
              <span key={t}>
                <span className="text-emerald-500">{t}</span>
                {i < skill.tags.length - 1 && ", "}
              </span>
            ))}
            ]
          </span>
        </div>
        <div>
          <span className="text-primary">created:</span>{" "}
          <span className="text-foreground">
            {formatDate(skill._creationTime)}
          </span>
        </div>
        <div className="text-muted-foreground/40">---</div>
      </div>
    </motion.div>
  );
}

interface SidebarCardsProps {
  skill: {
    name: string;
    markdown: string;
    authorName: string;
    votes: number;
    userVote?: "up" | "down" | null;
    sourceUrl?: string;
  };
  session: { user?: { id: string } } | null;
  handleVote: (direction: "up" | "down") => Promise<void>;
  isSaved?: boolean;
  onToggleSave?: () => Promise<void>;
}

export function SidebarCards({
  skill,
  session,
  handleVote,
  isSaved = false,
  onToggleSave,
}: SidebarCardsProps) {
  const [showSignInDialog, setShowSignInDialog] = useState(false);

  const onVoteClick = async (direction: "up" | "down") => {
    if (!session?.user) {
      setShowSignInDialog(true);
      return;
    }
    await handleVote(direction);
  };

  const onSaveClick = async () => {
    if (!session?.user) {
      setShowSignInDialog(true);
      return;
    }
    if (onToggleSave) {
      await onToggleSave();
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 flex flex-col gap-4 lg:col-span-4"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-black/5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">{skill.authorName}</p>
          <p className="text-muted-foreground text-sm">Contributor</p>
        </div>
        {onToggleSave && (
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 ${
              isSaved
                ? "bg-amber-500 text-white shadow-amber-500/20 shadow-lg"
                : "border border-border bg-card text-muted-foreground hover:border-amber-200 hover:bg-amber-500/10 hover:text-amber-500"
            } hover:scale-105 active:scale-95`}
            onClick={onSaveClick}
            title={isSaved ? "Remove from library" : "Save to library"}
            type="button"
          >
            {isSaved ? (
              <BookmarkCheck className="h-5 w-5" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl shadow-black/5">
        <div className="mb-4 flex items-center justify-center gap-8">
          <button
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-[transform,background-color,border-color,color,box-shadow] duration-200 ${
              skill.userVote === "up"
                ? "bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg"
                : "border border-border bg-card text-muted-foreground hover:border-emerald-200 hover:bg-emerald-500/10 hover:text-emerald-500"
            } hover:scale-105 active:scale-95`}
            onClick={() => onVoteClick("up")}
            type="button"
          >
            <ChevronUp className="h-6 w-6" strokeWidth={2.5} />
          </button>

          <div className="flex flex-col items-center">
            <span className="mb-1 font-bold text-5xl text-foreground">
              {skill.votes > 0 ? "+" : ""}
              {skill.votes}
            </span>
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              votes
            </span>
          </div>

          <button
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-[transform,background-color,border-color,color,box-shadow] duration-200 ${
              skill.userVote === "down"
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                : "border border-border bg-card text-muted-foreground hover:border-rose-200 hover:bg-rose-500/10 hover:text-rose-500"
            } hover:scale-105 active:scale-95`}
            onClick={() => onVoteClick("down")}
            type="button"
          >
            <ChevronDown className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <SignInDialog
        description="You need to be signed in to vote or save skills. Sign in or create an account to get started."
        onOpenChange={setShowSignInDialog}
        open={showSignInDialog}
        title="Sign in to continue"
      />
    </motion.div>
  );
}

interface AIScoreCardProps {
  aiScore: {
    overall: number;
    clarity: number;
    usefulness: number;
    completeness: number;
  };
}

export function AIScoreCard({ aiScore }: AIScoreCardProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-6 lg:col-span-4"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.25 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <h3 className="font-semibold text-indigo-500 text-sm">AI Analysis</h3>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted shadow-sm">
          <span className="font-bold text-2xl text-indigo-500">
            {aiScore.overall}
          </span>
        </div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          Overall quality score based on clarity, usefulness, and completeness
        </div>
      </div>

      <div className="space-y-2.5">
        {[
          { label: "Clarity", value: aiScore.clarity },
          { label: "Usefulness", value: aiScore.usefulness },
          { label: "Completeness", value: aiScore.completeness },
        ].map((score) => (
          <div className="flex items-center gap-3" key={score.label}>
            <span className="w-24 text-muted-foreground text-xs">
              {score.label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                animate={{ width: `${score.value}%` }}
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400"
                initial={{ width: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              />
            </div>
            <span className="w-6 font-semibold text-foreground text-xs">
              {score.value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface TagsCardProps {
  tags: string[];
  aiScore?: { overall: number } | null;
}

export function TagsCard({ tags, aiScore }: TagsCardProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`col-span-12 ${aiScore ? "lg:col-span-8" : "lg:col-span-12"} rounded-3xl border border-border bg-card p-6 shadow-sm`}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.3 }}
    >
      <h3 className="mb-4 font-semibold text-muted-foreground/60 text-sm uppercase tracking-wider">
        Tags
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <motion.span
            animate={{ opacity: 1, scale: 1 }}
            className="cursor-default rounded-full bg-muted px-4 py-2 font-medium text-foreground text-sm transition-colors hover:bg-muted/80"
            initial={{ opacity: 0, scale: 0.8 }}
            key={tag}
            transition={{ delay: 0.35 + index * 0.03 }}
          >
            {tag}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

interface InstallCommandCardProps {
  skill: {
    githubOwner?: string;
    githubRepo?: string;
    skillSlug?: string;
  };
}

export function InstallCommandCard({ skill }: InstallCommandCardProps) {
  const [copied, setCopied] = useState(false);
  const installCommand = getSkillInstallCommand(skill);

  if (!installCommand) {
    return null;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-6"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.2 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-emerald-500 text-sm">
            Install Command
          </h3>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-600 text-xs transition-colors hover:bg-emerald-500/20 active:scale-95"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-muted/50 p-4">
        <code className="block whitespace-nowrap font-mono text-foreground text-sm">
          <span className="text-emerald-500">$</span> {installCommand}
        </code>
      </div>
    </motion.div>
  );
}

interface InstallStatsCardProps {
  totalInstalls: number;
  weeklyInstalls: number;
  byAgent: Record<string, number>;
}

export function InstallStatsCard({
  totalInstalls,
  weeklyInstalls,
  byAgent,
}: InstallStatsCardProps) {
  const sortedAgents = Object.entries(byAgent)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  if (totalInstalls === 0 && weeklyInstalls === 0) {
    return null;
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 p-6 lg:col-span-6"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.25 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Download className="h-4 w-4 text-blue-500" />
        <h3 className="font-semibold text-blue-500 text-sm">Install Stats</h3>
      </div>

      <div className="mb-5 flex items-center gap-6">
        <div>
          <span className="font-bold text-3xl text-foreground">
            {formatInstallCount(totalInstalls)}
          </span>
          <p className="text-muted-foreground text-xs">Total Installs</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <span className="font-bold text-3xl text-foreground">
            {formatInstallCount(weeklyInstalls)}
          </span>
          <p className="text-muted-foreground text-xs">Weekly Installs</p>
        </div>
      </div>

      {sortedAgents.length > 0 && (
        <div>
          <h4 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Installed on
          </h4>
          <div className="flex flex-wrap gap-2">
            {sortedAgents.map(([agent, count]) => (
              <span
                className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-600 text-xs"
                key={agent}
              >
                {agentPlatformLabels[agent as AgentPlatform] || agent}{" "}
                <span className="font-semibold">
                  {formatInstallCount(count)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface RepositoryCardProps {
  githubOwner: string;
  githubRepo: string;
  githubStarsCached?: number;
}

export function RepositoryCard({
  githubOwner,
  githubRepo,
  githubStarsCached,
}: RepositoryCardProps) {
  const repoUrl = getGithubRepoUrl(githubOwner, githubRepo);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="col-span-12 rounded-3xl border border-border bg-card p-6 shadow-sm lg:col-span-6"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.25 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Github className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-muted-foreground/60 text-sm uppercase tracking-wider">
          Repository
        </h3>
      </div>

      <a
        className="group flex items-center gap-3 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
        href={repoUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/5">
          <Github className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">
            {githubOwner}/{githubRepo}
          </p>
          <p className="text-muted-foreground text-sm">View on GitHub</p>
        </div>
        {githubStarsCached !== undefined && githubStarsCached > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span className="font-semibold text-amber-600 text-sm">
              {formatInstallCount(githubStarsCached)}
            </span>
          </div>
        )}
        <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
      </a>
    </motion.div>
  );
}
