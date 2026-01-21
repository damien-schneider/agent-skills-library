"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Archive, RotateCcw, Shield, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { isAdminUser, type Skill } from "@/features/skills";
import { useAuthClient } from "@/shared/lib/auth-client";
import { formatSkillName } from "@/shared/lib/utils";

export default function ArchivedPage() {
  const router = useRouter();
  const { data: session, isPending } = useAuthClient.useSession();
  const isAdmin = isAdminUser(session?.user?.email);

  const archivedSkills =
    useQuery(api.skills.listArchived, {
      userId: session?.user?.id,
    }) ?? [];
  const unarchiveSkill = useMutation(api.skills.unarchive);
  const removeSkill = useMutation(api.skills.remove);

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Redirect non-admin users
  useEffect(() => {
    if (!(isPending || isAdmin)) {
      router.push("/");
    }
  }, [isPending, isAdmin, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const handleUnarchive = async (skillId: string) => {
    setProcessingIds((prev) => new Set(prev).add(skillId));
    try {
      await unarchiveSkill({ id: skillId as Skill["_id"] });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  };

  const handleDelete = async (skillId: string) => {
    setProcessingIds((prev) => new Set(prev).add(skillId));
    try {
      await removeSkill({ id: skillId as Skill["_id"] });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
      <div className="px-6 pt-32 pb-12">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-amber-600">
            <Shield className="h-4 w-4" />
            <span className="font-medium text-sm">Admin Only</span>
          </div>
          <h1
            className="mb-4 text-4xl text-foreground md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Archived <span className="italic">Skills</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Skills with a total score below -10 are automatically archived
          </p>
        </motion.div>
      </div>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-muted-foreground/20 to-muted-foreground/40">
              <Archive className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Archived Skills
              </h2>
              <p className="text-muted-foreground text-sm">
                {archivedSkills.length} skill
                {archivedSkills.length !== 1 ? "s" : ""} archived
              </p>
            </div>
          </div>

          {archivedSkills.length === 0 ? (
            <div className="py-12 text-center">
              <Archive className="mx-auto mb-4 h-12 w-12 text-muted/30" />
              <p className="text-muted-foreground">No archived skills</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Skills with a score below -10 will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {archivedSkills.map((skill, index) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-2xl border border-border bg-muted/50 p-4"
                  initial={{ opacity: 0, y: 10 }}
                  key={skill._id}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground">
                      {formatSkillName(skill.name)}
                    </h3>
                    <p className="mt-1 truncate text-muted-foreground text-sm">
                      {skill.category} • {skill.authorName}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span
                        className={`font-medium ${
                          skill.upvotes - skill.downvotes < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        Score: {skill.upvotes - skill.downvotes}
                      </span>
                      <span className="text-muted-foreground/60">
                        ({skill.upvotes} up / {skill.downvotes} down)
                      </span>
                    </div>
                  </div>

                  <div className="ml-4 flex items-center gap-2">
                    <button
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 font-medium text-emerald-600 text-sm transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                      disabled={processingIds.has(skill._id)}
                      onClick={() => handleUnarchive(skill._id)}
                      title="Restore skill"
                      type="button"
                    >
                      {processingIds.has(skill._id) ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-600" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Restore
                    </button>
                    <button
                      className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 font-medium text-destructive text-sm transition-colors hover:bg-destructive/20 disabled:opacity-50"
                      disabled={processingIds.has(skill._id)}
                      onClick={() => handleDelete(skill._id)}
                      title="Delete permanently"
                      type="button"
                    >
                      {processingIds.has(skill._id) ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive/20 border-t-destructive" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
