"use client";

import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatSkillName } from "@/shared/lib/utils";
import type { Skill } from "../lib/types";
import { defaultFolders, GlassFolder } from "./glass-folder";

interface OrbitalHeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onCategoryClick: (slug: string) => void;
  skills?: Skill[];
}

const placeholders = [
  "Explore security practices...",
  "Search for UI patterns...",
  "Find architecture skills...",
  "Discover testing strategies...",
];

export function OrbitalHero({
  searchQuery,
  onSearchChange,
  onSearch,
  onCategoryClick,
  skills = [],
}: OrbitalHeroProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Debounce the search query for suggestions
  const [debouncedQuery, { isPending }] = useDebouncedValue(
    searchQuery,
    {
      wait: 200,
      enabled: searchQuery.length > 0,
    },
    (state) => state
  );

  // Filter skills based on debounced query
  const suggestions = useMemo(() => {
    if (!debouncedQuery) {
      return [];
    }

    const query = debouncedQuery.toLowerCase();
    return skills
      .filter(
        (s) =>
          s.name.toLowerCase().replace(/-/g, " ").includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      )
      .slice(0, 5);
  }, [debouncedQuery, skills]);

  const showSuggestions = isFocused && searchQuery.length > 0;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div
        className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-64"
        style={{
          background:
            "linear-gradient(180deg, var(--color-border) 0%, transparent 100%)",
          opacity: 0.1,
        }}
      />

      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 20%, var(--primary) 0%, transparent 50%)",
          filter: "blur(120px) opacity(0.05)",
        }}
      />

      <div
        className="relative mx-auto w-full max-w-6xl px-6 py-20"
        ref={containerRef}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-full w-full">
            {defaultFolders.map((folder) => (
              <GlassFolder
                folder={folder}
                key={folder.category}
                mouseX={mouseX}
                mouseY={mouseY}
                onCategoryClick={onCategoryClick}
              />
            ))}
          </div>
        </div>

        <div className="relative z-20 flex flex-col items-center">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center"
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.h1
              className="text-5xl text-foreground leading-[1.1] tracking-tight md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="block"
                initial={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Find the
              </motion.span>
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="block"
                initial={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.8, delay: 0.35 }}
              >
                <span className="text-muted-foreground/60 italic">perfect</span>{" "}
                <span className="relative italic">
                  skill
                  <motion.span
                    animate={{ scaleX: 1 }}
                    className="absolute right-0 -bottom-1 left-0 h-0.5 origin-left bg-foreground/20"
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.8, delay: 0.9 }}
                  />
                </span>
              </motion.span>
            </motion.h1>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <motion.div
              animate={{
                boxShadow: isFocused
                  ? "0 0 0 1px var(--color-border), 0 8px 40px -12px rgba(0,0,0,0.1), 0 32px 64px -24px rgba(0,0,0,0.1)"
                  : "0 0 0 1px var(--color-border), 0 4px 24px -8px rgba(0,0,0,0.05), 0 16px 40px -16px rgba(0,0,0,0.05)",
              }}
              className="relative"
              style={{ borderRadius: 24 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="relative rounded-3xl bg-card/95 backdrop-blur-2xl"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-center px-6 py-5">
                  <motion.div
                    animate={{ scale: isFocused ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Search className="h-5 w-5 text-muted-foreground/50" />
                  </motion.div>

                  <div className="relative ml-4 flex-1">
                    <input
                      className="w-full border-none bg-transparent text-base text-foreground outline-none"
                      onBlur={() => setIsFocused(false)}
                      onChange={(e) => onSearchChange(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onKeyDown={(e) => e.key === "Enter" && onSearch()}
                      placeholder=""
                      type="text"
                      value={searchQuery}
                    />
                    {!searchQuery && (
                      <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className="pointer-events-none absolute inset-0 text-muted-foreground/40"
                        exit={{ opacity: 0, y: -10 }}
                        initial={{ opacity: 0, y: 10 }}
                        key={placeholderIndex}
                        transition={{ duration: 0.3 }}
                      >
                        {placeholders[placeholderIndex]}
                      </motion.span>
                    )}
                  </div>

                  <motion.button
                    className="ml-2 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background"
                    onClick={onSearch}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </div>

                <div className="flex items-center justify-between rounded-b-3xl border-border/20 border-t bg-muted/10 px-6 py-3">
                  <motion.button
                    className="flex items-center gap-2 text-muted-foreground/60 text-xs transition-colors hover:text-foreground/80"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Suggest</span>
                  </motion.button>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                    <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                      Ctrl
                    </kbd>
                    <span>+</span>
                    <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                      K
                    </kbd>
                  </div>
                </div>
              </div>

              {/* Search Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestions && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-xl backdrop-blur-xl"
                    exit={{ opacity: 0, y: -8 }}
                    initial={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="p-2">
                      {isPending && (
                        <div className="space-y-1">
                          {[1, 2, 3].map((i) => (
                            <div
                              className="flex animate-pulse items-center gap-3 rounded-xl px-4 py-3"
                              key={i}
                            >
                              <div className="h-8 w-8 rounded-lg bg-muted/40" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 w-1/4 rounded bg-muted/40" />
                                <div className="h-2 w-2/3 rounded bg-muted/20" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isPending &&
                        suggestions.length > 0 &&
                        suggestions.map((skill, index) => (
                          <motion.a
                            animate={{ opacity: 1, x: 0 }}
                            className="group flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                            href={`/skills/${skill._id}`}
                            initial={{ opacity: 0, x: -10 }}
                            key={skill._id}
                            onMouseDown={(e) => e.preventDefault()}
                            transition={{
                              duration: 0.2,
                              delay: index * 0.05,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${skill.color}20` }}
                            >
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: skill.color }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground text-sm group-hover:text-foreground">
                                {formatSkillName(skill.name)}
                              </p>
                              <p className="truncate text-muted-foreground text-xs">
                                {skill.description}
                              </p>
                            </div>
                            <motion.div
                              className="text-muted-foreground/40"
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 20,
                              }}
                              whileHover={{ x: 2 }}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </motion.div>
                          </motion.a>
                        ))}
                      {!isPending && suggestions.length === 0 && (
                        <div className="px-4 py-8 text-center">
                          <p className="text-muted-foreground text-sm">
                            No skills matching "{searchQuery}"
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="border-border/20 border-t bg-muted/20 px-4 py-2">
                      <p className="text-center text-muted-foreground/60 text-xs">
                        Press{" "}
                        <kbd className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px]">
                          Enter
                        </kbd>{" "}
                        to see all results
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          <motion.button
            animate={{ opacity: 1 }}
            className="mt-20 flex flex-col items-center gap-2 text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
            initial={{ opacity: 0 }}
            onClick={onSearch}
            transition={{ delay: 1.2 }}
          >
            <span className="text-xs tracking-wider">Explore all skills</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <svg
                aria-label="Scroll down"
                fill="none"
                height="18"
                role="img"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 20 20"
                width="18"
              >
                <path
                  d="M4 7l6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </motion.button>
        </div>
      </div>
    </section>
  );
}
