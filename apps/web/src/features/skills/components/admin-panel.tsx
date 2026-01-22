"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Shield,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

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
interface ReportedSkill {
  _id: string;
  name: string;
  authorName: string;
  category: string;
  reports: Array<{
    _id: string;
    reason: string;
    reporterId: string;
    _creationTime: number;
  }>;
}

export function AdminPanel({ userEmail }: AdminPanelProps) {
  const isAdmin = userEmail === ADMIN_EMAIL;
  const allSkills = useQuery(api.skills.list, {}) ?? [];

  const moderationApi = api as typeof api & {
    moderation: {
      listReportedSkills: FunctionReference<
        "query",
        "public",
        Record<string, never>
      >;
      hideSkill: FunctionReference<"mutation", "public">;
      dismissReports: FunctionReference<"mutation", "public">;
    };
  };

  const reportedSkills = useQuery(
    moderationApi.moderation.listReportedSkills,
    {}
  ) as ReportedSkill[] | undefined;
  const removeSkill = useMutation(api.skills.remove);
  const hideSkill = useMutation(moderationApi.moderation.hideSkill);
  const dismissReports = useMutation(moderationApi.moderation.dismissReports);

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedReports, setExpandedReports] = useState<Set<string>>(
    new Set()
  );

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

  const handleHideSkill = async (skillId: string) => {
    setProcessingIds((prev) => new Set(prev).add(skillId));
    try {
      await hideSkill({ skillId: skillId as Skill["_id"] });
      toast.success("Skill hidden successfully");
    } catch {
      toast.error("Failed to hide skill");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  };

  const handleDismissReports = async (skillId: string) => {
    setProcessingIds((prev) => new Set(prev).add(skillId));
    try {
      await dismissReports({ skillId: skillId as Skill["_id"] });
      toast.success("Reports dismissed successfully");
    } catch {
      toast.error("Failed to dismiss reports");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    }
  };

  const toggleReportExpansion = (skillId: string) => {
    setExpandedReports((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
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
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            Total Skills
          </div>
          <p className="mt-1 font-semibold text-2xl text-foreground">
            {allSkills.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Shield className="h-4 w-4" />
            Admin Access
          </div>
          <p className="mt-1 font-semibold text-emerald-500 text-sm">Enabled</p>
        </div>
      </div>

      {/* Skills Management */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
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

      {/* Reported Skills */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <h3 className="font-semibold text-foreground">Reported Skills</h3>
          {reportedSkills && reportedSkills.length > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs">
              {reportedSkills.length}
            </span>
          )}
        </div>

        {reportedSkills === undefined && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />
          </div>
        )}
        {reportedSkills !== undefined && reportedSkills.length === 0 && (
          <p className="py-8 text-center text-muted-foreground text-sm">
            No reported skills to review.
          </p>
        )}
        {reportedSkills !== undefined && reportedSkills.length > 0 && (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {reportedSkills.map((skill) => (
              <div
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                key={skill._id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground text-sm">
                      {formatSkillName(skill.name)}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {skill.category} • {skill.authorName}
                    </p>
                    <button
                      className="mt-2 flex items-center gap-1 text-amber-600 text-xs transition-colors hover:text-amber-700"
                      onClick={() => toggleReportExpansion(skill._id)}
                      type="button"
                    >
                      <span>
                        {skill.reports.length} report
                        {skill.reports.length !== 1 ? "s" : ""}
                      </span>
                      {expandedReports.has(skill._id) ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    {expandedReports.has(skill._id) && (
                      <div className="mt-2 space-y-1.5">
                        {skill.reports.map((report) => (
                          <div
                            className="rounded-lg bg-background/50 px-3 py-2 text-muted-foreground text-xs"
                            key={report._id}
                          >
                            "{report.reason}"
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      disabled={processingIds.has(skill._id)}
                      onClick={() => handleDismissReports(skill._id)}
                      title="Dismiss reports"
                      type="button"
                    >
                      {processingIds.has(skill._id) ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      disabled={processingIds.has(skill._id)}
                      onClick={() => handleHideSkill(skill._id)}
                      title="Hide skill"
                      type="button"
                    >
                      {processingIds.has(skill._id) ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function isAdminUser(email?: string): boolean {
  return email === ADMIN_EMAIL;
}
