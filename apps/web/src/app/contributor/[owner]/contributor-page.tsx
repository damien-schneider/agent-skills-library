"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { ExternalLink, Github, Users } from "lucide-react";
import { motion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";

import { SkillCard } from "@/features/skills/components/skill-card";
import { getSkillUrl, type Skill } from "@/features/skills/lib/types";
import { useAuthClient } from "@/shared/lib/auth-client";

interface ContributorClientPageProps {
  owner: string;
}

export function ContributorClientPage({ owner }: ContributorClientPageProps) {
  const { data: session } = useAuthClient.useSession();
  const skills = useQuery(api.skills.listByGithubOwner, {
    githubOwner: owner,
    userId: session?.user?.id,
  });
  const categories = useQuery(api.categories.list) ?? [];

  if (!skills) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  const totalInstalls = skills.reduce(
    (sum, skill) => sum + (skill.installCount ?? 0),
    0
  );

  const repos = new Set(skills.map((s) => s.githubRepo).filter(Boolean));

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-6 pt-28 pb-20">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted"
            initial={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.1 }}
          >
            <Github className="h-10 w-10 text-foreground" />
          </motion.div>

          <h1
            className="mb-4 text-balance text-4xl text-foreground leading-tight md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {owner}
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            GitHub Contributor
          </p>

          <motion.a
            animate={{ opacity: 1 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted/80 hover:text-foreground"
            href={`https://github.com/${owner}`}
            initial={{ opacity: 0 }}
            rel="noopener noreferrer"
            target="_blank"
            transition={{ delay: 0.2 }}
          >
            <Github className="h-4 w-4" />
            View on GitHub
            <ExternalLink className="h-3 w-3" />
          </motion.a>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.15 }}
        >
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="mb-1 font-bold text-3xl text-foreground">
              {skills.length}
            </p>
            <p className="text-muted-foreground text-sm">
              Skill{skills.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="mb-1 font-bold text-3xl text-foreground">
              {repos.size}
            </p>
            <p className="text-muted-foreground text-sm">
              Repositor{repos.size !== 1 ? "ies" : "y"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="mb-1 font-bold text-3xl text-foreground">
              {totalInstalls.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-sm">Total Installs</p>
          </div>
        </motion.div>

        {skills.length > 0 ? (
          <>
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 flex items-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2 }}
            >
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-xl">
                Skills by {owner}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill, index) => (
                <SkillCard
                  categories={categories}
                  index={index}
                  key={skill._id}
                  skill={skill as Skill}
                />
              ))}
            </div>
          </>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-muted-foreground">
              No skills found from this contributor.
            </p>
          </motion.div>
        )}

        {skills.length > 0 && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 rounded-2xl border border-border bg-card p-6"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.25 }}
          >
            <h3 className="mb-4 font-semibold text-foreground">All Skills</h3>
            <div className="space-y-2">
              {skills.map((skill) => (
                <Link
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 transition-colors hover:bg-muted"
                  href={getSkillUrl(skill) as Route}
                  key={skill._id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground text-sm">
                      {skill.name}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {skill.githubRepo && `${skill.githubRepo} • `}
                      {skill.category}
                    </p>
                  </div>
                  <div className="ml-4 text-muted-foreground text-xs">
                    {skill.installCount
                      ? `${skill.installCount.toLocaleString()} installs`
                      : ""}
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
