"use client";

import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Skill } from "../lib/types";
import { defaultFolders, GlassFolder } from "./glass-folder";
import { BigSearchBar, MinimalSearchBar } from "./shared-search-bar";

// Scroll threshold as percentage of viewport height
const SCROLL_THRESHOLD_PERCENT = 65;

interface OrbitalHeroProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onCategoryClick: (slug: string, categoryName: string) => void;
  onRandomSkill: () => void;
  skills?: Skill[];
}

export function OrbitalHero({
  searchQuery,
  onSearchChange,
  onSearch,
  onCategoryClick,
  onRandomSkill,
  skills = [],
}: OrbitalHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showMinimalBar, setShowMinimalBar] = useState(false);
  const scrollThresholdRef = useRef(
    typeof window !== "undefined"
      ? window.innerHeight * (SCROLL_THRESHOLD_PERCENT / 100)
      : 0
  );

  // Cache container rect to avoid layout thrashing on every mousemove
  const containerRectRef = useRef<DOMRect | null>(null);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const updateContainerRect = useCallback(() => {
    if (containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      scrollThresholdRef.current =
        window.innerHeight * (SCROLL_THRESHOLD_PERCENT / 100);
      updateContainerRect();
    };

    updateContainerRect();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateContainerRect]);

  // Use motion's scroll tracking
  const { scrollY } = useScroll();

  // Show minimal bar when scrolled past threshold
  useMotionValueEvent(scrollY, "change", (scroll) => {
    setShowMinimalBar(scroll > scrollThresholdRef.current);
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRectRef.current;
      if (rect) {
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section className="relative flex h-[80vh] flex-col items-center justify-center">
      {/* Fixed minimal search bar at top */}
      <div className="pointer-events-none fixed top-20 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-6 will-change-[opacity,transform] lg:top-6">
        <MinimalSearchBar
          isVisible={showMinimalBar}
          onSearch={onSearch}
          onSearchChange={onSearchChange}
          searchQuery={searchQuery}
        />
      </div>

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

        <div className="pointer-events-none relative z-20 flex flex-col items-center *:pointer-events-auto">
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

          {/* Big search bar - stays in place */}
          <div className="w-full max-w-xl">
            <BigSearchBar
              hideSuggestions={showMinimalBar}
              onRandomSkill={onRandomSkill}
              onSearch={onSearch}
              onSearchChange={onSearchChange}
              searchQuery={searchQuery}
              skills={skills}
            />
          </div>
        </div>
      </div>
      <motion.button
        animate={{ opacity: 1 }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
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
    </section>
  );
}
