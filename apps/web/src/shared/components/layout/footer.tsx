"use client";

import { Github, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import {
  GITHUB_AUTHOR_URL,
  GITHUB_REPOSITORY_URL,
} from "@/shared/lib/constants";

const CURRENT_YEAR = 2026;

export default function Footer() {
  const router = useRouter();

  const handleSearchShortcut = useCallback(() => {
    const heroSearchInput = document.querySelector(
      'section input[type="text"]'
    ) as HTMLInputElement | null;
    if (heroSearchInput) {
      heroSearchInput.focus();
      heroSearchInput.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      router.push("/?focus=search");
    }
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleSearchShortcut();
      }
      // Cmd/Ctrl + N for new skill
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        const isInputFocused =
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA";
        if (!isInputFocused) {
          e.preventDefault();
          router.push("/skills/new");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSearchShortcut, router]);

  return (
    <footer className="relative mt-auto w-full p-4">
      <div className="relative mx-auto max-w-7xl rounded-4xl border border-border/40 bg-card px-3 shadow-2xl">
        {/* Subtle gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-muted/5 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 py-10">
          {/* Main content - compact single row on desktop */}
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5">
                <span className="font-semibold text-foreground text-sm">
                  AL
                </span>
              </div>
              <span
                className="font-medium text-foreground text-sm tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Agents Library
              </span>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                className="text-muted-foreground/70 text-sm transition-colors hover:text-foreground"
                href="/what-are-agent-skills"
              >
                What Are Agent Skills?
              </Link>
              <Link
                className="text-muted-foreground/70 text-sm transition-colors hover:text-foreground"
                href="/skills/new"
              >
                Create Skill
              </Link>
              <Link
                className="text-muted-foreground/70 text-sm transition-colors hover:text-foreground"
                href="/privacy"
              >
                Privacy
              </Link>
              <Link
                className="text-muted-foreground/70 text-sm transition-colors hover:text-foreground"
                href="/terms"
              >
                Terms
              </Link>
              <a
                className="text-muted-foreground/70 text-sm transition-colors hover:text-foreground"
                href={GITHUB_REPOSITORY_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                GitHub
              </a>
            </nav>

            {/* Keyboard shortcuts */}
            <div className="flex items-center gap-4">
              <button
                className="flex items-center gap-2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                onClick={handleSearchShortcut}
                title="Search (⌘K)"
                type="button"
              >
                <Search className="h-3.5 w-3.5" />
                <kbd className="hidden rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                  ⌘K
                </kbd>
              </button>
              <Link
                className="flex items-center gap-2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                href="/skills/new"
                title="New Skill (⌘N)"
              >
                <Plus className="h-3.5 w-3.5" />
                <kbd className="hidden rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                  ⌘N
                </kbd>
              </Link>
              <a
                aria-label="GitHub repository"
                className="rounded-full p-2 text-muted-foreground/50 transition-colors hover:bg-muted/30 hover:text-foreground"
                href={GITHUB_REPOSITORY_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-border/20 border-t pt-6 md:flex-row">
            <p className="text-muted-foreground/50 text-xs">
              © {CURRENT_YEAR} Agents Library
            </p>
            <p className="flex items-center gap-1.5 text-muted-foreground/50 text-xs">
              made by{" "}
              <a
                className="transition-colors hover:text-foreground"
                href={GITHUB_AUTHOR_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                damien schneider
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
