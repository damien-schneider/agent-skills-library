"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Filter, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";

import { useAuthClient } from "@/shared/lib/auth-client";

import type { Skill } from "../lib/types";
import { OrbitalHero } from "./orbital-hero";
import { SkillCard } from "./skill-card";

export function HomeView() {
  const { data: session } = useAuthClient.useSession();
  const categories = useQuery(api.categories.list) ?? [];

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"votes" | "date" | "score">("votes");

  const heroRef = useRef<HTMLDivElement>(null);

  const { results, status, loadMore } = usePaginatedQuery(
    api.skills.listPaginated,
    {
      category: selectedCategory ?? undefined,
      search: searchQuery || undefined,
      sortBy,
      userId: session?.user?.id,
    },
    { initialNumItems: 24 }
  );

  const skills = results as Skill[];

  const handleSearch = useCallback(() => {
    setTimeout(() => {
      document
        .getElementById("skills-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const handleCategoryClick = useCallback((slug: string) => {
    setSelectedCategory(slug);
    setTimeout(() => {
      document
        .getElementById("skills-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  const handleRandomSkill = useCallback(() => {
    if (skills.length === 0) {
      return;
    }
    const randomIndex = Math.floor(Math.random() * skills.length);
    const randomSkill = skills[randomIndex];
    window.location.href = `/skills/${randomSkill._id}`;
  }, [skills]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-linear-to-b from-background via-background to-muted/20" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(99,102,241,0.03) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10">
        <div ref={heroRef}>
          <OrbitalHero
            onCategoryClick={handleCategoryClick}
            onRandomSkill={handleRandomSkill}
            onSearch={handleSearch}
            onSearchChange={setSearchQuery}
            searchQuery={searchQuery}
            skills={skills}
          />
        </div>

        <section
          className="min-h-screen bg-linear-to-b from-transparent via-background to-background px-6 py-24"
          id="skills-section"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-12">
              <h2
                className="mb-10 text-3xl text-foreground md:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selectedCategory
                  ? categories.find((c) => c.slug === selectedCategory)?.name
                  : "All Skills"}
              </h2>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={`rounded-full px-5 py-2.5 font-medium text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                      selectedCategory
                        ? "border border-border/50 bg-card/60 text-muted-foreground backdrop-blur-sm hover:bg-card/80"
                        : "bg-foreground text-background shadow-foreground/10 shadow-lg"
                    }`}
                    onClick={() => setSelectedCategory(null)}
                    type="button"
                  >
                    All
                  </button>
                  {categories.map((category) => (
                    <button
                      className={`rounded-full px-5 py-2.5 font-medium text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                        selectedCategory === category.slug
                          ? "text-white shadow-lg"
                          : "border border-border/50 bg-card/60 text-muted-foreground backdrop-blur-sm hover:bg-card/80"
                      }`}
                      key={category._id}
                      onClick={() => setSelectedCategory(category.slug)}
                      style={
                        selectedCategory === category.slug
                          ? {
                              backgroundColor: category.color,
                              boxShadow: `0 4px 20px -4px ${category.color}50`,
                            }
                          : {}
                      }
                      type="button"
                    >
                      {category.name}
                      <span className="ml-1.5 text-xs opacity-70">
                        {category.skillCount}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <span className="text-muted-foreground text-sm">Sort by</span>
                  <select
                    className="cursor-pointer rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 text-foreground text-sm outline-none backdrop-blur-sm transition-all hover:bg-card/80 focus:ring-2 focus:ring-primary/20"
                    onChange={(e) =>
                      setSortBy(e.target.value as "votes" | "date" | "score")
                    }
                    value={sortBy}
                  >
                    <option value="votes">Most Voted</option>
                    <option value="date">Newest</option>
                    <option value="score">AI Score</option>
                  </select>
                </div>
              </div>

              <p className="mt-8 text-muted-foreground text-sm">
                {skills.length} skill
                {skills.length !== 1 ? "s" : ""} found
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8 xl:grid-cols-4">
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

            {status === "CanLoadMore" && (
              <motion.div
                className="mt-16 flex justify-center"
                initial={{ opacity: 0 }}
                onViewportEnter={() => loadMore(12)}
                whileInView={{ opacity: 1 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading more skills...</span>
                </div>
              </motion.div>
            )}

            {skills.length === 0 && status === "Exhausted" && (
              <div className="py-24 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 backdrop-blur-sm">
                  <Filter className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="mb-2 font-medium text-foreground text-xl">
                  No skills found
                </h3>
                <p className="mb-8 text-muted-foreground">
                  Try adjusting your filters or search query
                </p>
                <button
                  className="rounded-full bg-foreground px-6 py-3 font-medium text-background text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery("");
                  }}
                  type="button"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
