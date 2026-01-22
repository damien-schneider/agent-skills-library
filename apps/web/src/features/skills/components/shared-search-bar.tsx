"use client";

import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { ArrowRight, Search, Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { cn, formatSkillName } from "@/shared/lib/utils";
import type { Skill } from "../lib/types";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  skills?: Skill[];
  isMinimal?: boolean;
  onRandomSkill?: () => void;
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

function getBoxShadow(isMinimal: boolean, isFocused: boolean): string {
  if (isMinimal) {
    return isFocused ? BOX_SHADOWS.minimalFocused : BOX_SHADOWS.minimalBlurred;
  }
  return isFocused ? BOX_SHADOWS.fullFocused : BOX_SHADOWS.fullBlurred;
}

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
      <div className="text-muted-foreground/40 transition-transform hover:translate-x-0.5">
        <ArrowRight className="h-4 w-4" />
      </div>
    </motion.a>
  ));
}

export function SharedSearchBar({
  searchQuery,
  onSearchChange,
  onSearch,
  skills = [],
  isMinimal = false,
  onRandomSkill,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Debounce the search query for suggestions
  const [debouncedQuery] = useDebouncedValue(searchQuery, {
    wait: 200,
    enabled: searchQuery.length > 0,
  });

  const isPending = searchQuery !== debouncedQuery && searchQuery.length > 0;

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

  const showSuggestions = isFocused && searchQuery.length > 0 && !isMinimal;

  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const boxShadow = getBoxShadow(isMinimal, isFocused);

  // Fixed heights for smooth transitions
  // Minimal: 36px button + 4px padding top + 4px padding bottom = 44px
  // Full: 48px button + 12px padding top + 12px padding bottom = 72px
  const mainInputHeight = isMinimal ? 44 : 72;
  const bottomSectionHeight = isMinimal ? 0 : 44;
  const totalHeight = mainInputHeight + bottomSectionHeight;

  return (
    <div
      className="relative transition-all duration-500 ease-out"
      style={{
        boxShadow,
        borderRadius: isMinimal ? 9999 : 24,
        height: totalHeight,
      }}
    >
      <div
        className="relative h-full overflow-hidden rounded-3xl bg-card/95 backdrop-blur-2xl transition-all duration-500 ease-out"
        style={{
          border: "1px solid var(--border)",
        }}
      >
        {/* Main input section */}
        <div
          className={cn(
            "flex items-center transition-all duration-500 ease-out",
            isMinimal ? "gap-3 px-1.5" : "px-6"
          )}
          style={{ height: mainInputHeight }}
        >
          <div
            className={cn(
              "transition-all duration-300 ease-out",
              isMinimal && "ml-2.5"
            )}
            style={{
              transform: isFocused ? "scale(1.1)" : "scale(1)",
            }}
          >
            <Search
              className={cn(
                "text-muted-foreground/50 transition-all duration-500 ease-out",
                isMinimal ? "h-4 w-4" : "h-5 w-5"
              )}
            />
          </div>

          <div
            className={cn(
              "relative flex-1 transition-all duration-500 ease-out",
              !isMinimal && "ml-4"
            )}
          >
            <input
              className={cn(
                "w-full border-none bg-transparent text-foreground outline-none transition-all duration-300",
                isMinimal ? "text-sm" : "text-base"
              )}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder={isMinimal ? "Search skills..." : ""}
              type="text"
              value={searchQuery}
            />
            <AnimatePresence mode="wait">
              {!(searchQuery || isMinimal) && (
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
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all duration-500 ease-out hover:scale-105 active:scale-95",
              isMinimal ? "h-9 w-9" : "ml-2 h-12 w-12"
            )}
            onClick={onSearch}
            type="button"
          >
            <ArrowRight
              className={cn(
                "transition-all duration-500 ease-out",
                isMinimal ? "h-4 w-4" : "h-5 w-5"
              )}
            />
          </button>
        </div>

        {/* Bottom section with smooth height animation */}
        <div
          className="overflow-hidden transition-all duration-500 ease-out"
          style={{
            height: bottomSectionHeight,
            opacity: isMinimal ? 0 : 1,
          }}
        >
          <div className="flex h-11 items-center justify-between border-border/20 border-t bg-muted/10 px-6">
            <button
              className="flex items-center gap-2 text-muted-foreground/60 text-xs transition-all hover:scale-[1.02] hover:text-foreground/80 active:scale-[0.98]"
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
              <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono">
                K
              </kbd>
            </div>
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
              {isPending && <SearchSuggestionsSkeleton />}
              {!isPending && (
                <SearchSuggestions
                  searchQuery={searchQuery}
                  suggestions={suggestions}
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
