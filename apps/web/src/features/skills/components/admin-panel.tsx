"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Shield, Trash2, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { formatSkillName } from "@/shared/lib/utils";
import type { Skill } from "../lib/types";

const ADMIN_EMAIL = "admin@mail.com";

interface AdminPanelProps {
  userEmail?: string;
}

/**
 * Admin panel for managing skills - only accessible to admin users
 * Used in the /archived page for viewing and managing archived skills
 */
export function AdminPanel({ userEmail }: AdminPanelProps) {
  const isAdmin = userEmail === ADMIN_EMAIL;
  const allSkills = useQuery(api.skills.list, {}) ?? [];
  const removeSkill = useMutation(api.skills.remove);

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  if (!isAdmin) {
    return null;
  }

  const handleDeleteSkill = async (skillId: string) => {
    setDeletingIds((prev) => new Set(prev).add(skillId));
    try {
      await removeSkill({ id: skillId as Skill["_id"] });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      {/* Admin Header */}
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-lg">Admin Panel</h2>
          <p className="text-muted-foreground text-sm">
            Manage skills and view archived content
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            Total Skills
          </div>
          <p className="mt-1 font-semibold text-2xl text-foreground">
            {allSkills.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Shield className="h-4 w-4" />
            Admin Access
          </div>
          <p className="mt-1 font-semibold text-emerald-500 text-sm">Enabled</p>
        </div>
      </div>

      {/* Skills Management */}
      <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <h3 className="mb-4 font-semibold text-foreground">Manage Skills</h3>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {allSkills.map((skill) => (
            <div
              className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"
              key={skill._id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-sm">
                  {formatSkillName(skill.name)}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {skill.category} • {skill.authorName}
                </p>
              </div>
              <button
                className="ml-2 rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                disabled={deletingIds.has(skill._id)}
                onClick={() => handleDeleteSkill(skill._id)}
                type="button"
              >
                {deletingIds.has(skill._id) ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
          {allSkills.length === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No skills found.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function isAdminUser(email?: string): boolean {
  return email === ADMIN_EMAIL;
}
