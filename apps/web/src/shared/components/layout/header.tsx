"use client";

import { ArrowLeftIcon, BookMarked, Github, LogIn, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ModeToggle } from "@/features/auth/components/mode-toggle";
import { SignInDialog } from "@/shared/components/ui/sign-in-dialog";
import { useAuthClient } from "@/shared/lib/auth-client";
import { GITHUB_REPOSITORY_URL } from "@/shared/lib/constants";

export default function Header() {
  const pathname = usePathname();
  const { data: session, isPending } = useAuthClient.useSession();
  const isAuthenticated = !!session?.user;
  const isHomePage = pathname === "/";
  const showBackButton = !isHomePage;
  const [isSignInDialogOpen, setIsSignInDialogOpen] = useState(false);

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
                    className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2.5 font-medium text-foreground text-sm shadow-lg transition-transform duration-200 hover:-translate-x-0.5 hover:scale-102 active:scale-98"
                    type="button"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back
                  </button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
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
                      className="rounded-full border border-border bg-card/95 p-3 shadow-sm transition-transform duration-200 hover:scale-105 active:scale-95"
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
                        className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-5 py-2.5 font-medium text-foreground text-sm shadow-sm transition-transform duration-200 hover:scale-102 active:scale-98"
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
                    <button
                      className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-5 py-2.5 font-medium text-foreground text-sm shadow-sm transition-transform duration-200 hover:scale-102 active:scale-98"
                      onClick={() => setIsSignInDialogOpen(true)}
                      type="button"
                    >
                      <LogIn className="h-4 w-4" />
                      Connect
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            <a
              aria-label="GitHub repository"
              className="rounded-full border border-border bg-card/95 p-3 shadow-sm transition-transform duration-200 hover:scale-105 active:scale-95"
              href={GITHUB_REPOSITORY_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github className="h-5 w-5 text-foreground" />
            </a>

            <ModeToggle />
          </div>
        </div>
      </div>
      <SignInDialog
        onOpenChange={setIsSignInDialogOpen}
        open={isSignInDialogOpen}
      />
    </motion.header>
  );
}
