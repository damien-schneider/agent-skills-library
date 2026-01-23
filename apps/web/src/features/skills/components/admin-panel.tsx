"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  EyeOff,
  Github,
  Link2,
  Loader2,
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

interface ImportResult {
  name: string;
  status: "imported" | "skipped" | "error";
  reason?: string;
}

interface ImportSummary {
  imported: number;
  skipped: number;
  errors: number;
  installCountsUpdated?: number;
}

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

  const [importUrl, setImportUrl] = useState("");
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isImportingSkillsSh, setIsImportingSkillsSh] = useState(false);
  const [importResults, setImportResults] = useState<{
    results: ImportResult[];
    summary: ImportSummary;
    reposDiscovered?: string[];
  } | null>(null);

  const autoImportApi = api as typeof api & {
    autoImport: {
      importAllOfficialRepos: FunctionReference<"action", "public">;
      importFromUrl: FunctionReference<"action", "public">;
      importFromSkillsSh: FunctionReference<"action", "public">;
    };
    officialRepos: {
      seedOfficialRepos: FunctionReference<"mutation", "public">;
    };
  };

  const importAllOfficialRepos = useAction(
    autoImportApi.autoImport.importAllOfficialRepos
  );
  const importFromUrl = useAction(autoImportApi.autoImport.importFromUrl);
  const importFromSkillsSh = useAction(
    autoImportApi.autoImport.importFromSkillsSh
  );
  const seedOfficialRepos = useMutation(
    autoImportApi.officialRepos.seedOfficialRepos
  );

  if (!isAdmin) {
    return null;
  }

  const handleImportAllOfficial = async () => {
    setIsImportingAll(true);
    setImportResults(null);

    try {
      await seedOfficialRepos({});

      const result = await importAllOfficialRepos({});

      const allResults: ImportResult[] = result.repoResults.flatMap(
        (r: { results: ImportResult[] }) => r.results
      );

      setImportResults({
        results: allResults,
        summary: result.totalSummary,
      });

      if (result.totalSummary.imported > 0) {
        toast.success(
          `Imported ${result.totalSummary.imported} skills from official repos`
        );
      } else if (result.totalSummary.skipped > 0) {
        toast.info(`All ${result.totalSummary.skipped} skills already exist`);
      } else {
        toast.warning("No skills found in official repos");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import skills"
      );
    } finally {
      setIsImportingAll(false);
    }
  };

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      toast.error("Please enter a GitHub URL");
      return;
    }

    setIsImportingUrl(true);
    setImportResults(null);

    try {
      const result = await importFromUrl({ url: importUrl.trim() });

      setImportResults(result);

      if (result.summary.imported > 0) {
        toast.success(`Imported ${result.summary.imported} skills`);
        setImportUrl("");
      } else if (result.summary.skipped > 0) {
        toast.info(`All ${result.summary.skipped} skills already exist`);
      } else if (result.summary.errors > 0) {
        toast.error(result.results[0]?.reason || "Failed to import skills");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import skills"
      );
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handleImportFromSkillsSh = async () => {
    setIsImportingSkillsSh(true);
    setImportResults(null);

    try {
      const result = await importFromSkillsSh({ maxPages: 10 });

      setImportResults({
        results: result.results,
        summary: result.summary,
        reposDiscovered: result.reposDiscovered,
      });

      if (result.summary.imported > 0) {
        toast.success(
          `Imported ${result.summary.imported} skills from ${result.reposDiscovered.length} repos`
        );
      } else if (result.summary.skipped > 0) {
        toast.info(`All ${result.summary.skipped} skills already exist`);
      }

      if (result.summary.installCountsUpdated > 0) {
        toast.info(
          `Updated install counts for ${result.summary.installCountsUpdated} skills`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to import from skills.sh"
      );
    } finally {
      setIsImportingSkillsSh(false);
    }
  };

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

      <AutoPopulateSection
        importResults={importResults}
        importUrl={importUrl}
        isImportingAll={isImportingAll}
        isImportingSkillsSh={isImportingSkillsSh}
        isImportingUrl={isImportingUrl}
        onImportAllOfficial={handleImportAllOfficial}
        onImportFromSkillsSh={handleImportFromSkillsSh}
        onImportFromUrl={handleImportFromUrl}
        setImportUrl={setImportUrl}
      />

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

interface AutoPopulateSectionProps {
  importUrl: string;
  setImportUrl: (url: string) => void;
  isImportingAll: boolean;
  isImportingUrl: boolean;
  isImportingSkillsSh: boolean;
  importResults: {
    results: ImportResult[];
    summary: ImportSummary;
    reposDiscovered?: string[];
  } | null;
  onImportAllOfficial: () => void;
  onImportFromUrl: () => void;
  onImportFromSkillsSh: () => void;
}

function AutoPopulateSection({
  importUrl,
  setImportUrl,
  isImportingAll,
  isImportingUrl,
  isImportingSkillsSh,
  importResults,
  onImportAllOfficial,
  onImportFromUrl,
  onImportFromSkillsSh,
}: AutoPopulateSectionProps) {
  const isImporting = isImportingAll || isImportingUrl || isImportingSkillsSh;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <Download className="h-4 w-4 text-emerald-500" />
        </div>
        <h3 className="font-semibold text-foreground">Auto-Populate Skills</h3>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground text-sm">
              Import from Official Repos
            </span>
          </div>
          <p className="mb-3 text-muted-foreground text-xs">
            Import skills from known official repositories: Anthropic, Expo,
            Vercel Labs, Better Auth, Supabase, Stripe
          </p>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-sm text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isImporting}
            onClick={onImportAllOfficial}
            type="button"
          >
            {isImportingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Import All Official Repos
              </>
            )}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground text-sm">
              Import from URL
            </span>
          </div>
          <p className="mb-3 text-muted-foreground text-xs">
            Import skills from any public GitHub repository URL
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              disabled={isImporting}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImporting) {
                  onImportFromUrl();
                }
              }}
              placeholder="https://github.com/owner/repo"
              type="url"
              value={importUrl}
            />
            <button
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isImporting || !importUrl.trim()}
              onClick={onImportFromUrl}
              type="button"
            >
              {isImportingUrl ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-foreground text-sm">
              Import from skills.sh Leaderboard
            </span>
          </div>
          <p className="mb-3 text-muted-foreground text-xs">
            Import popular skills from skills.sh leaderboard with their install
            counts. Discovers repos automatically.
          </p>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isImporting}
            onClick={onImportFromSkillsSh}
            type="button"
          >
            {isImportingSkillsSh ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing from skills.sh...
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Import from skills.sh
              </>
            )}
          </button>
        </div>

        {importResults && (
          <ImportResultsDisplay
            results={importResults.results}
            summary={importResults.summary}
          />
        )}
      </div>
    </div>
  );
}

interface ImportResultsDisplayProps {
  results: ImportResult[];
  summary: ImportSummary;
}

function getStatusColor(status: ImportResult["status"]): string {
  if (status === "imported") {
    return "text-emerald-600";
  }
  if (status === "skipped") {
    return "text-amber-600";
  }
  return "text-red-600";
}

function ImportResultsDisplay({ results, summary }: ImportResultsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-foreground text-sm">
          Import Results
        </span>
        <div className="flex gap-3 text-xs">
          {summary.imported > 0 && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              {summary.imported} imported
            </span>
          )}
          {summary.skipped > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <XCircle className="h-3 w-3" />
              {summary.skipped} skipped
            </span>
          )}
          {summary.errors > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {summary.errors} errors
            </span>
          )}
          {summary.installCountsUpdated !== undefined &&
            summary.installCountsUpdated > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <Download className="h-3 w-3" />
                {summary.installCountsUpdated} updated
              </span>
            )}
        </div>
      </div>

      {results.length > 3 && (
        <button
          className="mb-2 flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show all {results.length} results
            </>
          )}
        </button>
      )}

      <div className="max-h-48 space-y-1 overflow-y-auto">
        {(isExpanded ? results : results.slice(0, 3)).map((result, index) => (
          <div
            className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-1.5 text-xs"
            key={`${result.name}-${index}`}
          >
            <span className="truncate text-foreground">{result.name}</span>
            <span className={getStatusColor(result.status)}>
              {result.status}
              {result.reason && (
                <span className="ml-1 text-muted-foreground">
                  ({result.reason})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
