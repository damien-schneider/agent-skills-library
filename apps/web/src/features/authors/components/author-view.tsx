"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { ArrowLeft, User2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { type Category, type Skill, SkillCard } from "@/features/skills";
import { useAuthClient } from "@/shared/lib/auth-client";

interface AuthorViewProps {
  authorId: string;
}

function SkillsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          className="aspect-[280/240] animate-pulse rounded-3xl bg-muted/30"
          key={`skeleton-${i.toString()}`}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="py-24 text-center"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
        <User2 className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="mb-2 font-medium text-foreground text-xl">
        No skills found
      </h3>
      <p className="mb-8 text-muted-foreground">
        This author hasn't contributed any skills yet
      </p>
      <Link
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
        href="/"
      >
        Browse all skills
      </Link>
    </motion.div>
  );
}

interface SkillsGridProps {
  skills: Skill[];
  authorName: string;
  categories: Category[];
}

function SkillsGrid({ skills, authorName, categories }: SkillsGridProps) {
  return (
    <>
      <motion.h2
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-2xl text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        style={{ fontFamily: "var(--font-display)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        Skills by {authorName}
      </motion.h2>

      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 xl:grid-cols-4"
        style={{ contain: "layout style" }}
      >
        <AnimatePresence mode="popLayout">
          {skills.map((skill, index) => (
            <SkillCard
              categories={categories}
              index={index}
              key={skill._id}
              skill={skill}
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function SkillsSectionContent({
  isLoading,
  skills,
  authorName,
  categories,
}: {
  isLoading: boolean;
  skills: Skill[] | undefined;
  authorName: string;
  categories: Category[];
}) {
  if (isLoading) {
    return <SkillsGridSkeleton />;
  }

  if (!skills || skills.length === 0) {
    return <EmptyState />;
  }

  return (
    <SkillsGrid
      authorName={authorName}
      categories={categories}
      skills={skills}
    />
  );
}

export function AuthorView({ authorId }: AuthorViewProps) {
  const { data: session } = useAuthClient.useSession();
  const categories = useQuery(api.categories.list) ?? [];

  const skills = useQuery(api.skills.listByAuthor, {
    authorId,
    userId: session?.user?.id,
  });

  const isLoading = skills === undefined;
  const authorName = skills?.[0]?.authorName ?? "Unknown Author";
  const skillCount = skills?.length ?? 0;
  const pluralSuffix = skillCount !== 1 ? "s" : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-border/40 border-b bg-gradient-to-b from-muted/30 to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 py-12 md:py-20">
          <Link
            className="group mb-8 inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Library
          </Link>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-card/80 shadow-black/5 shadow-lg md:h-24 md:w-24">
              <User2 className="h-10 w-10 text-muted-foreground/60 md:h-12 md:w-12" />
            </div>

            <div className="flex flex-col gap-2">
              <h1
                className="text-3xl text-foreground md:text-4xl lg:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {isLoading ? (
                  <span className="inline-block h-10 w-48 animate-pulse rounded-lg bg-muted/50" />
                ) : (
                  authorName
                )}
              </h1>

              <p className="text-lg text-muted-foreground">
                {isLoading ? (
                  <span className="inline-block h-6 w-32 animate-pulse rounded-md bg-muted/50" />
                ) : (
                  `${skillCount} skill${pluralSuffix} contributed`
                )}
              </p>
            </div>
          </motion.div>
        </div>
      </header>

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <SkillsSectionContent
            authorName={authorName}
            categories={categories as Category[]}
            isLoading={isLoading}
            skills={skills as Skill[] | undefined}
          />
        </div>
      </section>
    </div>
  );
}
