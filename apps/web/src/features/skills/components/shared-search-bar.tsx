"use client";

import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { ArrowRight, Search, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { formatSkillName } from "@/shared/lib/utils";
import type { Skill } from "../lib/types";

interface BaseSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
}

interface BigSearchBarProps extends BaseSearchBarProps {
  skills?: Skill[];
  onRandomSkill?: () => void;
  hideSuggestions?: boolean;
}

interface MinimalSearchBarProps extends BaseSearchBarProps {
  isVisible: boolean;
}

const placeholders = [
  "Explore security practices...",
  "Search for UI patterns...",
  "Find architecture skills...",
  "Discover testing strategies...",
];

const BOX_SHADOWS = {
  minimalFocused:
    "0 0 0 1px var(--color-border), 0 8px 32px -8px rgba(0,0,0,0.15), 0 4px 12px -4px rgba(0,0,0,0.1)",
  minimalBlurred:
    "0 0 0 1px var(--color-border), 0 6px 24px -6px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.08)",
  fullFocused:
    "0 0 0 1px var(--color-border), 0 8px 40px -12px rgba(0,0,0,0.1), 0 32px 64px -24px rgba(0,0,0,0.1)",
  fullBlurred:
    "0 0 0 1px var(--color-border), 0 4px 24px -8px rgba(0,0,0,0.05), 0 16px 40px -16px rgba(0,0,0,0.05)",
} as const;

function SearchSuggestionsSkeleton() {
  return (
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
  );
}

function SearchSuggestions({
  searchQuery,
  suggestions,
}: {
  searchQuery: string;
  suggestions: Skill[];
}) {
  if (suggestions.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          No skills matching "{searchQuery}"
        </p>
      </div>
    );
  }

  return suggestions.map((skill, index) => (
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
      <div className="transform-gpu text-muted-foreground/40 transition-transform hover:translate-x-0.5">
        <ArrowRight className="h-4 w-4" />
      </div>
    </motion.a>
  ));
}

/**
 * Big search bar - stays in the hero, full featured with suggestions
 */
export function BigSearchBar({
  searchQuery,
  onSearchChange,
  onSearch,
  skills = [],
  onRandomSkill,
  hideSuggestions = false,
}: BigSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [previousSuggestions, setPreviousSuggestions] = useState<Skill[]>([]);

  const [debouncedQuery] = useDebouncedValue(searchQuery, {
    wait: 200,
    enabled: searchQuery.length > 0,
  });

  const isPending = searchQuery !== debouncedQuery && searchQuery.length > 0;

  const suggestions = useMemo(() => {
    if (!debouncedQuery) {
      return [];
    }

    const query = debouncedQuery.toLowerCase();
    return skills
      .filter(
        (s) =>
          s.name.toLowerCase().replaceAll("-", " ").includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      )
      .slice(0, 5);
  }, [debouncedQuery, skills]);

  // Update previous suggestions when new ones are ready
  useEffect(() => {
    if (!isPending && suggestions.length > 0) {
      setPreviousSuggestions(suggestions);
    }
  }, [isPending, suggestions]);

  // Reset previous suggestions when search is cleared
  useEffect(() => {
    if (searchQuery.length === 0) {
      setPreviousSuggestions([]);
    }
  }, [searchQuery]);

  const showSuggestions =
    isFocused && searchQuery.length > 0 && !hideSuggestions;

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const boxShadow = isFocused
    ? BOX_SHADOWS.fullFocused
    : BOX_SHADOWS.fullBlurred;

  return (
    <div
      className="relative"
      style={{
        boxShadow,
        borderRadius: 24,
      }}
    >
      <div
        className="relative overflow-hidden rounded-3xl bg-card/98"
        style={{
          border: "1px solid var(--border)",
        }}
      >
        {/* Main input section */}
        <div className="flex h-18 items-center px-6">
          <div
            style={{
              transform: isFocused ? "scale(1.1)" : "scale(1)",
              transition: "transform 0.3s ease-out",
            }}
          >
            <Search className="h-5 w-5 text-muted-foreground/50" />
          </div>

          <div className="relative ml-4 flex-1">
            <input
              className="w-full border-none bg-transparent text-base text-foreground outline-none"
              onBlur={() => setIsFocused(false)}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              type="text"
              value={searchQuery}
            />
            <AnimatePresence mode="wait">
              {!searchQuery && (
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="pointer-events-none absolute inset-0 text-muted-foreground/40"
                  exit={{ opacity: 0, y: -10 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={placeholderIndex}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {placeholders[placeholderIndex]}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <button
            className="ml-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
            onClick={onSearch}
            type="button"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Bottom section */}
        <div className="flex h-11 items-center justify-between border-border/20 border-t bg-muted/10 px-6">
          <button
            className="flex items-center gap-2 text-muted-foreground/60 text-xs transition-[transform,color] hover:scale-[1.02] hover:text-foreground/80 active:scale-[0.98]"
            onClick={onRandomSkill}
            type="button"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Random Skill</span>
          </button>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
            <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono">K</kbd>
          </div>
        </div>
      </div>

      {/* Search Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border/50 bg-card/98 shadow-xl"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="p-2">
              {isPending && previousSuggestions.length === 0 ? (
                <SearchSuggestionsSkeleton />
              ) : (
                <SearchSuggestions
                  searchQuery={isPending ? debouncedQuery : searchQuery}
                  suggestions={isPending ? previousSuggestions : suggestions}
                />
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
    </div>
  );
}

/**
 * Minimal search bar - fixed at top, appears on scroll with translateY animation
 */
export function MinimalSearchBar({
  searchQuery,
  onSearchChange,
  onSearch,
  isVisible,
}: MinimalSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const boxShadow = isFocused
    ? BOX_SHADOWS.minimalFocused
    : BOX_SHADOWS.minimalBlurred;

  return (
    <motion.div
      animate={{
        y: isVisible ? 0 : -100,
        opacity: isVisible ? 1 : 0,
      }}
      className="pointer-events-auto"
      initial={{ y: -100, opacity: 0 }}
      style={{
        boxShadow,
        borderRadius: 9999,
      }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="relative overflow-hidden rounded-full bg-card/98"
        style={{
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex h-11 items-center gap-3 px-1.5">
          <div className="ml-2.5">
            <Search className="h-4 w-4 text-muted-foreground/50" />
          </div>

          <input
            className="w-full flex-1 border-none bg-transparent text-foreground text-sm outline-none"
            onBlur={() => setIsFocused(false)}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="Search skills..."
            type="text"
            value={searchQuery}
          />

          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95"
            onClick={onSearch}
            type="button"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
