"use client";

import {
  Archive,
  ArrowLeft,
  BookMarked,
  Github,
  LogIn,
  Plus,
} from "lucide-react";
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
      className="fixed top-0 right-0 left-0 z-50 w-full"
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div
          className={`flex items-center ${showBackButton ? "justify-between" : "justify-end"} gap-3`}
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
                  <motion.button
                    className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2.5 font-medium text-foreground text-sm shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-card"
                    whileHover={{ scale: 1.02, x: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </motion.button>
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
                    <motion.button
                      aria-label="View archived skills"
                      className="rounded-full border border-amber-500/30 bg-amber-500/10 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-amber-500/20"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Archive className="h-5 w-5 text-amber-500" />
                    </motion.button>
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
                    <motion.button
                      aria-label="Create new skill"
                      className="rounded-full border border-border bg-card/80 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-card"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Plus className="h-5 w-5 text-foreground" />
                    </motion.button>
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
                      <motion.button
                        className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 font-medium text-foreground text-sm shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-card"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <BookMarked className="h-4 w-4" />
                        My Library
                      </motion.button>
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
                      <motion.button
                        className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 font-medium text-foreground text-sm shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-card"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <LogIn className="h-4 w-4" />
                        Connect
                      </motion.button>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            <motion.a
              aria-label="GitHub repository"
              className="rounded-full border border-border bg-card/80 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-card"
              href="https://github.com/anomalyco/skills-agent-library"
              rel="noopener noreferrer"
              target="_blank"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Github className="h-5 w-5 text-foreground" />
            </motion.a>

            <ModeToggle />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
