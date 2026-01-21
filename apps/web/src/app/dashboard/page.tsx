"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { BookMarked, LogOut, Settings, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignInForm, SignUpForm } from "@/features/auth";
import {
  AdminPanel,
  isAdminUser,
} from "@/features/skills/components/admin-panel";
import { SkillCard } from "@/features/skills/components/skill-card";
import { SkillImportForm } from "@/features/skills/components/skill-import-form-new";
import type { Skill } from "@/features/skills/lib/types";
import { authClient, useAuthClient } from "@/shared/lib/auth-client";

type DashboardTab = "library" | "import" | "admin";

function LibraryView() {
  const router = useRouter();
  const { data: session } = useAuthClient.useSession();
  const user = useQuery(api.auth.getCurrentUser);
  const categories = useQuery(api.categories.list) ?? [];
  const rawSavedSkills =
    useQuery(
      api.savedSkills.list,
      session?.user?.id ? { userId: session.user.id } : "skip"
    ) ?? [];

  const userEmail = session?.user?.email;
  const isAdmin = isAdminUser(userEmail);

  const [activeTab, setActiveTab] = useState<DashboardTab>("library");

  const savedSkills: Skill[] = rawSavedSkills
    .filter(
      (skill): skill is NonNullable<typeof skill> & { _id: string } =>
        skill !== null && skill._id !== undefined
    )
    .map((skill) => ({
      ...skill,
      userVote: null,
    }));

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="px-6 pt-32 pb-12">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1
                className="mb-2 text-4xl text-foreground md:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                My <span className="italic">Library</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Welcome back, {user?.name || session?.user?.name || "there"}
              </p>
            </div>
            <motion.button
              className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2.5 font-medium text-foreground/70 text-sm shadow-sm backdrop-blur-md transition-all duration-200 hover:bg-card hover:text-foreground"
              onClick={handleSignOut}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </motion.button>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8 flex gap-2">
            <button
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-medium text-sm transition-all ${
                activeTab === "library"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setActiveTab("library")}
              type="button"
            >
              <BookMarked className="h-4 w-4" />
              My Library
            </button>
            <button
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-medium text-sm transition-all ${
                activeTab === "import"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              onClick={() => setActiveTab("import")}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              Import Skill
            </button>
            {isAdmin && (
              <button
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-medium text-sm transition-all ${
                  activeTab === "admin"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-50"
                    : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                }`}
                onClick={() => setActiveTab("admin")}
                type="button"
              >
                <Settings className="h-4 w-4" />
                Admin
              </button>
            )}
          </div>
        </motion.div>
      </div>

      <main className="mx-auto max-w-7xl px-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "library" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key="library"
            >
              <div className="mb-8 flex items-center gap-2 text-muted-foreground">
                <BookMarked className="h-5 w-5" />
                <span className="font-medium">
                  {savedSkills.length} saved skill
                  {savedSkills.length !== 1 ? "s" : ""}
                </span>
              </div>

              {savedSkills.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {savedSkills.map((skill, index) => (
                      <SkillCard
                        categories={categories}
                        index={index}
                        key={skill._id}
                        skill={skill}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="py-24 text-center"
                  initial={{ opacity: 0, y: 20 }}
                >
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 backdrop-blur-sm">
                    <Sparkles className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="mb-2 font-medium text-foreground text-xl">
                    No saved skills yet
                  </h3>
                  <p className="mb-8 text-muted-foreground">
                    Start exploring and save skills to your library
                  </p>
                  <Link href="/">
                    <motion.button
                      className="rounded-full bg-foreground px-6 py-3 font-medium text-background text-sm"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Explore Skills
                    </motion.button>
                  </Link>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "import" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-xl"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key="import"
            >
              <SkillImportForm />
            </motion.div>
          )}

          {activeTab === "admin" && isAdmin && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto max-w-2xl"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key="admin"
            >
              <AdminPanel userEmail={userEmail} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function AuthView() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/">
            <h1
              className="mb-2 cursor-pointer text-2xl text-foreground transition-opacity hover:opacity-80"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Skills Library
            </h1>
          </Link>
        </motion.div>

        {showSignIn ? (
          <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Authenticated>
        <LibraryView />
      </Authenticated>
      <Unauthenticated>
        <AuthView />
      </Unauthenticated>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
        </div>
      </AuthLoading>
    </>
  );
}
