"use client";

import { Archive, BookMarked, Github, LogIn, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/features/auth/components/mode-toggle";
import { isAdminUser } from "@/features/skills";
import { useAuthClient } from "@/shared/lib/auth-client";

export default function Header() {
  const pathname = usePathname();
  const { data: session, isPending } = useAuthClient.useSession();
  const isAuthenticated = !!session?.user;
  const isAdmin = isAdminUser(session?.user?.email);
  const isHomePage = pathname === "/";
  const showBackButton = !isHomePage;

  return (
    <motion.header
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none fixed top-0 right-0 left-0 z-50 w-full"
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div
          className={`flex items-center ${showBackButton ? "justify-between" : "justify-end"} gap-3 *:pointer-events-auto`}
        >
          <AnimatePresence>
            {showBackButton && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                initial={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Link href="/" prefetch>
                  <button
                    className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2.5 font-medium text-foreground text-sm shadow-lg backdrop-blur-md transition-all duration-200 hover:-translate-x-0.5 hover:scale-102 hover:bg-card active:scale-98"
                    type="button"
                  >
                    <Archive className="h-4 w-4" />
                    Back
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            {/* Admin Archive Button */}
            <AnimatePresence>
              {isAdmin && pathname !== "/archived" && (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                >
                  <Link href="/archived" prefetch>
                    <button
                      aria-label="View archived skills"
                      className="rounded-full border border-amber-500/30 bg-amber-500/10 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-amber-500/20 active:scale-95"
                      type="button"
                    >
                      <Archive className="h-5 w-5 text-amber-500" />
                    </button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {pathname !== "/skills/new" && (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                >
                  <Link href="/skills/new" prefetch>
                    <button
                      aria-label="Create new skill"
                      className="rounded-full border border-border bg-card/80 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-card active:scale-95"
                      type="button"
                    >
                      <Plus className="h-5 w-5 text-foreground" />
                    </button>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            {!isPending && (
              <AnimatePresence mode="wait">
                {isAuthenticated ? (
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    key="library"
                  >
                    <Link href="/dashboard" prefetch>
                      <button
                        className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 font-medium text-foreground text-sm shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-102 hover:bg-card active:scale-98"
                        type="button"
                      >
                        <BookMarked className="h-4 w-4" />
                        My Library
                      </button>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    key="connect"
                  >
                    <Link href="/dashboard" prefetch>
                      <button
                        className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 font-medium text-foreground text-sm shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-102 hover:bg-card active:scale-98"
                        type="button"
                      >
                        <LogIn className="h-4 w-4" />
                        Connect
                      </button>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            <a
              aria-label="GitHub repository"
              className="rounded-full border border-border bg-card/80 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-card active:scale-95"
              href="https://github.com/anomalyco/skills-agent-library"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github className="h-5 w-5 text-foreground" />
            </a>

            <ModeToggle />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
