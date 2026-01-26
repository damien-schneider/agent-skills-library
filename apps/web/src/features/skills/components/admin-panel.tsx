"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  EyeOff,
  Github,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
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
  status: "imported" | "skipped" | "error" | "updated";
  reason?: string;
}

interface ImportSummary {
  imported: number;
  skipped: number;
  errors: number;
  updated?: number;
  installCountsUpdated?: number;
}

const ADMIN_EMAIL = "admin@mail.com";
const GITHUB_URL_REGEX = /github\.com\/([^/]+)\/([^/]+)/;
const GIT_SUFFIX_REGEX = /\.git$/;

interface AdminPanelProps {
  userEmail?: string;
}

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
  const totalSkillCount = useQuery(api.skills.totalCount, {}) ?? 0;
  const {
    results: adminSkills,
    status: adminSkillsStatus,
    loadMore: loadMoreAdminSkills,
  } = usePaginatedQuery(api.skills.listForAdmin, {}, { initialNumItems: 50 });
  const archivedSkills = useQuery(api.skills.listArchived, {}) ?? [];
  const unarchiveSkill = useMutation(api.skills.unarchive);

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
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isSyncingFromSkillsSh, setIsSyncingFromSkillsSh] = useState(false);
  const [isSyncingRepos, setIsSyncingRepos] = useState(false);
  const [isSyncingMetadata, setIsSyncingMetadata] = useState(false);
  const [isSyncingContent, setIsSyncingContent] = useState(false);
  const [isSyncingAllRepos, setIsSyncingAllRepos] = useState(false);
  const [importResults, setImportResults] = useState<{
    results: ImportResult[];
    summary: ImportSummary;
    reposDiscovered?: string[];
  } | null>(null);

  // Subscribe to sync progress for real-time updates
  const syncProgressApi = api as Record<string, Record<string, unknown>>;
  const syncProgress = useQuery(
    syncProgressApi.syncProgress?.get as FunctionReference<"query", "public">,
    { syncType: "skillssh" }
  ) as SyncProgress | null | undefined;
  const resetSyncProgressMutation = useMutation(
    syncProgressApi.syncProgress?.reset as FunctionReference<
      "mutation",
      "public"
    >
  );
  const resetSyncProgress = async (args: { syncType: string }) => {
    if (syncProgressApi.syncProgress?.reset) {
      await resetSyncProgressMutation(args);
    }
  };

  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [syncingRepoIds, setSyncingRepoIds] = useState<Set<string>>(new Set());
  const [deletingRepoIds, setDeletingRepoIds] = useState<Set<string>>(
    new Set()
  );

  const autoImportApi = api as typeof api & {
    autoImport: {
      importFromUrl: FunctionReference<"action", "public">;
      syncOfficialRepo: FunctionReference<"action", "public">;
      fetchRepoInstallCounts: FunctionReference<"action", "public">;
      syncAllReferenceRepos: FunctionReference<"action", "public">;
      syncFromSkillsSh: FunctionReference<"action", "public">;
      syncReposFromSkillsSh: FunctionReference<"action", "public">;
      syncSkillsMetadataFromSkillsSh: FunctionReference<"action", "public">;
      syncSkillsContent: FunctionReference<"action", "public">;
    };
  };

  const officialRepos = useQuery(api.officialRepos.list, {}) ?? [];
  const importFromUrl = useAction(autoImportApi.autoImport.importFromUrl);
  const syncOfficialRepo = useAction(autoImportApi.autoImport.syncOfficialRepo);
  const fetchRepoInstallCounts = useAction(
    autoImportApi.autoImport.fetchRepoInstallCounts
  );
  const syncAllReferenceRepos = useAction(
    autoImportApi.autoImport.syncAllReferenceRepos
  );
  const syncFromSkillsSh = useAction(autoImportApi.autoImport.syncFromSkillsSh);
  const syncReposFromSkillsSh = useAction(
    autoImportApi.autoImport.syncReposFromSkillsSh
  );
  const syncSkillsMetadataFromSkillsSh = useAction(
    autoImportApi.autoImport.syncSkillsMetadataFromSkillsSh
  );
  const syncSkillsContent = useAction(
    autoImportApi.autoImport.syncSkillsContent
  );
  const createOfficialRepo = useMutation(api.officialRepos.create);
  const removeOfficialRepo = useMutation(api.officialRepos.remove);

  if (!isAdmin) {
    return null;
  }

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

  const handleSyncFromSkillsSh = async () => {
    setIsSyncingFromSkillsSh(true);

    try {
      // The action will update progress via mutations that we subscribe to
      const result = await syncFromSkillsSh({});

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const messages = [
        result.reposCreated > 0 && `${result.reposCreated} new repos`,
        result.skillsCreated > 0 && `${result.skillsCreated} skills created`,
        result.installCountsUpdated > 0 &&
          `${result.installCountsUpdated} install counts updated`,
      ].filter(Boolean);

      if (messages.length > 0) {
        toast.success(`Synced from skills.sh: ${messages.join(", ")}`);
      } else {
        toast.info(
          `Found ${result.uniqueReposFound} repos, all skills already up to date`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sync from skills.sh"
      );
    } finally {
      setIsSyncingFromSkillsSh(false);
    }
  };

  const handleResetSyncProgress = async () => {
    await resetSyncProgress({ syncType: "skillssh" });
  };

  const handleSyncRepos = async () => {
    setIsSyncingRepos(true);
    try {
      const result = await syncReposFromSkillsSh({});
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Repos synced: ${result.reposCreated} created, ${result.reposUpdated} updated`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sync repos"
      );
    } finally {
      setIsSyncingRepos(false);
    }
  };

  const handleSyncMetadata = async () => {
    setIsSyncingMetadata(true);
    try {
      const result = await syncSkillsMetadataFromSkillsSh({});
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Skills synced: ${result.skillsCreated} created, ${result.installCountsUpdated} install counts updated`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sync skills metadata"
      );
    } finally {
      setIsSyncingMetadata(false);
    }
  };

  const handleSyncContent = async () => {
    setIsSyncingContent(true);
    try {
      const result = await syncSkillsContent({});
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Content fetched: ${result.contentFetched} skills updated, ${result.contentFailed} failed`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sync content"
      );
    } finally {
      setIsSyncingContent(false);
    }
  };

  const handleSyncAllRepos = async () => {
    setIsSyncingAllRepos(true);
    setImportResults(null);

    try {
      const result = await syncAllReferenceRepos({});

      const allResults: ImportResult[] = result.repoResults.flatMap(
        (r: { results: ImportResult[] }) => r.results
      );

      setImportResults({
        results: allResults,
        summary: result.totalSummary,
      });

      const messages: string[] = [];
      if (result.totalSummary.imported > 0) {
        messages.push(`Imported ${result.totalSummary.imported} skills`);
      }
      if (result.totalSummary.updated > 0) {
        messages.push(`Updated ${result.totalSummary.updated} skills`);
      }
      if (result.installCountsUpdated > 0) {
        messages.push(`Updated ${result.installCountsUpdated} install counts`);
      }

      if (messages.length > 0) {
        toast.success(messages.join(". "));
      } else if (result.totalSummary.skipped > 0) {
        toast.info(`All ${result.totalSummary.skipped} skills already exist`);
      } else {
        toast.warning("No skills found in reference repositories");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sync reference repositories"
      );
    } finally {
      setIsSyncingAllRepos(false);
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

  const handleUnarchive = async (skillId: string) => {
    setProcessingIds((prev) => new Set(prev).add(skillId));
    try {
      await unarchiveSkill({ id: skillId as Skill["_id"] });
      toast.success("Skill restored successfully");
    } catch {
      toast.error("Failed to restore skill");
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

  const parseGitHubUrl = (
    url: string
  ): { owner: string; repo: string } | null => {
    const match = url.match(GITHUB_URL_REGEX);
    if (!(match?.[1] && match?.[2])) {
      return null;
    }
    return { owner: match[1], repo: match[2].replace(GIT_SUFFIX_REGEX, "") };
  };

  const handleAddRepo = async () => {
    const parsed = parseGitHubUrl(newRepoUrl.trim());
    if (!parsed) {
      toast.error("Invalid GitHub URL");
      return;
    }

    setIsAddingRepo(true);
    try {
      await createOfficialRepo({
        githubOwner: parsed.owner,
        githubRepo: parsed.repo,
        displayName: `${parsed.owner}/${parsed.repo}`,
      });
      toast.success(`Added ${parsed.owner}/${parsed.repo}`);
      setNewRepoUrl("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add repository"
      );
    } finally {
      setIsAddingRepo(false);
    }
  };

  const handleSyncRepo = async (repoId: string) => {
    setSyncingRepoIds((prev) => new Set(prev).add(repoId));
    try {
      const repo = officialRepos.find((r) => r._id === repoId);
      if (!repo) {
        toast.error("Repository not found");
        return;
      }

      const result = await syncOfficialRepo({
        repoId: repoId as Id<"officialRepos">,
      });

      const installResult = await fetchRepoInstallCounts({
        githubOwner: repo.githubOwner,
        githubRepo: repo.githubRepo,
      });

      const messages: string[] = [];
      if (result.summary.imported > 0) {
        messages.push(`Imported ${result.summary.imported} skills`);
      }
      if (installResult.updated > 0) {
        messages.push(`Updated ${installResult.updated} install counts`);
      }

      if (messages.length > 0) {
        toast.success(messages.join(". "));
      } else if (result.summary.skipped > 0) {
        toast.info(`All ${result.summary.skipped} skills already exist`);
      } else if (result.summary.errors > 0) {
        toast.error(result.results[0]?.reason ?? "Import failed");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sync repository"
      );
    } finally {
      setSyncingRepoIds((prev) => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
    }
  };

  const handleRemoveRepo = async (repoId: string) => {
    setDeletingRepoIds((prev) => new Set(prev).add(repoId));
    try {
      await removeOfficialRepo({ id: repoId as Id<"officialRepos"> });
      toast.success("Repository removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove repository"
      );
    } finally {
      setDeletingRepoIds((prev) => {
        const next = new Set(prev);
        next.delete(repoId);
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
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Users className="h-4 w-4" />
            Total Skills
          </div>
          <p className="mt-1 font-semibold text-2xl text-foreground">
            {totalSkillCount.toLocaleString()}
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
        isImportingUrl={isImportingUrl}
        isSyncingContent={isSyncingContent}
        isSyncingFromSkillsSh={isSyncingFromSkillsSh}
        isSyncingMetadata={isSyncingMetadata}
        isSyncingRepos={isSyncingRepos}
        onImportFromUrl={handleImportFromUrl}
        onResetSyncProgress={handleResetSyncProgress}
        onSyncContent={handleSyncContent}
        onSyncFromSkillsSh={handleSyncFromSkillsSh}
        onSyncMetadata={handleSyncMetadata}
        onSyncRepos={handleSyncRepos}
        setImportUrl={setImportUrl}
        syncProgress={syncProgress ?? null}
      />

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <Database className="h-4 w-4 text-purple-500" />
            </div>
            <h3 className="font-semibold text-foreground">
              Reference Repositories
            </h3>
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 font-medium text-purple-600 text-xs">
              {officialRepos.length}
            </span>
          </div>
          {officialRepos.length > 0 && (
            <button
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSyncingAllRepos}
              onClick={handleSyncAllRepos}
              title="Sync all repositories"
              type="button"
            >
              {isSyncingAllRepos ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sync All
                </>
              )}
            </button>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground text-sm">
              Add Repository
            </span>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              disabled={isAddingRepo}
              onChange={(e) => setNewRepoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isAddingRepo) {
                  handleAddRepo();
                }
              }}
              placeholder="https://github.com/owner/repo"
              type="url"
              value={newRepoUrl}
            />
            <button
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAddingRepo || !newRepoUrl.trim()}
              onClick={handleAddRepo}
              type="button"
            >
              {isAddingRepo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {officialRepos.map((repo) => (
            <div
              className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3"
              key={repo._id}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    className="truncate font-medium text-foreground text-sm hover:underline"
                    href={`https://github.com/${repo.githubOwner}/${repo.githubRepo}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {repo.githubOwner}/{repo.githubRepo}
                  </a>
                  {repo.isVerified && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                </div>
                <p className="ml-6 text-muted-foreground text-xs">
                  {repo.skillCount ?? 0} skills • {repo.totalInstalls ?? 0}{" "}
                  installs
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  disabled={syncingRepoIds.has(repo._id)}
                  onClick={() => handleSyncRepo(repo._id)}
                  title="Sync skills"
                  type="button"
                >
                  {syncingRepoIds.has(repo._id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
                <button
                  className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  disabled={deletingRepoIds.has(repo._id)}
                  onClick={() => handleRemoveRepo(repo._id)}
                  title="Remove repository"
                  type="button"
                >
                  {deletingRepoIds.has(repo._id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
          {officialRepos.length === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No reference repositories. Add one above or import from official
              repos.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Manage Skills</h3>
          <span className="text-muted-foreground text-sm">
            Showing {adminSkills.length} of {totalSkillCount.toLocaleString()}
          </span>
        </div>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {adminSkills.map((skill) => (
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
          {adminSkills.length === 0 && adminSkillsStatus === "Exhausted" && (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No skills found.
            </p>
          )}
          {adminSkillsStatus === "CanLoadMore" && (
            <button
              className="mt-2 w-full rounded-xl border border-border bg-muted/30 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={() => loadMoreAdminSkills(50)}
              type="button"
            >
              Load more skills...
            </button>
          )}
          {adminSkillsStatus === "LoadingMore" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
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

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-muted-foreground/20 to-muted-foreground/40">
            <Archive className="h-4 w-4 text-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">Archived Skills</h3>
          {archivedSkills.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
              {archivedSkills.length}
            </span>
          )}
        </div>
        <p className="mb-4 text-muted-foreground text-sm">
          Skills with a total score below -10 are automatically archived
        </p>

        {archivedSkills.length === 0 ? (
          <div className="py-8 text-center">
            <Archive className="mx-auto mb-3 h-10 w-10 text-muted/30" />
            <p className="text-muted-foreground text-sm">No archived skills</p>
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {archivedSkills.map((skill) => (
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
                  <p
                    className={`mt-1 text-xs ${
                      skill.upvotes - skill.downvotes < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    Score: {skill.upvotes - skill.downvotes}
                  </p>
                </div>
                <div className="ml-2 flex gap-1">
                  <button
                    className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                    disabled={processingIds.has(skill._id)}
                    onClick={() => handleUnarchive(skill._id)}
                    title="Restore skill"
                    type="button"
                  >
                    {processingIds.has(skill._id) ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    disabled={deletingIds.has(skill._id)}
                    onClick={() => handleDeleteSkill(skill._id)}
                    title="Delete permanently"
                    type="button"
                  >
                    {deletingIds.has(skill._id) ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
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

interface SyncProgress {
  syncType: string;
  status: "idle" | "fetching" | "processing" | "completed" | "error";
  currentPhase: string;
  totalItems: number;
  processedItems: number;
  totalSkillsFetched: number;
  uniqueReposFound: number;
  reposCreated: number;
  reposUpdated: number;
  skillsCreated: number;
  installCountsUpdated: number;
  errorMessage?: string;
  startedAt: number;
  completedAt?: number;
}

interface AutoPopulateSectionProps {
  importUrl: string;
  setImportUrl: (url: string) => void;
  isImportingUrl: boolean;
  isSyncingFromSkillsSh: boolean;
  isSyncingRepos: boolean;
  isSyncingMetadata: boolean;
  isSyncingContent: boolean;
  importResults: {
    results: ImportResult[];
    summary: ImportSummary;
    reposDiscovered?: string[];
  } | null;
  syncProgress: SyncProgress | null;
  onImportFromUrl: () => void;
  onSyncFromSkillsSh: () => void;
  onSyncRepos: () => void;
  onSyncMetadata: () => void;
  onSyncContent: () => void;
  onResetSyncProgress: () => void;
}

function SyncProgressUI({ progress }: { progress: SyncProgress }) {
  const isActive =
    progress.status === "fetching" || progress.status === "processing";
  const isCompleted = progress.status === "completed";
  const isError = progress.status === "error";

  const progressPercent =
    progress.totalItems > 0
      ? Math.round((progress.processedItems / progress.totalItems) * 100)
      : 0;

  const elapsedTime = progress.completedAt
    ? progress.completedAt - progress.startedAt
    : Date.now() - progress.startedAt;

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getTextColorClass = () => {
    if (isError) {
      return "text-red-600";
    }
    if (isCompleted) {
      return "text-emerald-600";
    }
    return "text-blue-600";
  };

  return (
    <div className="mt-3 space-y-3">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {isError && <AlertTriangle className="h-4 w-4 text-red-500" />}
          <span className={`font-medium text-sm ${getTextColorClass()}`}>
            {progress.currentPhase}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">
          {formatDuration(elapsedTime)}
        </span>
      </div>

      {/* Progress bar */}
      {isActive && progress.totalItems > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>
              {progress.processedItems.toLocaleString()} /{" "}
              {progress.totalItems.toLocaleString()}
            </span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {isError && progress.errorMessage && (
        <div className="rounded-lg bg-red-500/10 p-3 text-red-600 text-xs">
          {progress.errorMessage}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-background/50 p-3 text-xs">
        <div>
          <span className="text-muted-foreground">Skills fetched:</span>{" "}
          <span className="font-medium text-foreground">
            {progress.totalSkillsFetched.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Repos found:</span>{" "}
          <span className="font-medium text-foreground">
            {progress.uniqueReposFound.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">New repos:</span>{" "}
          <span className="font-medium text-emerald-600">
            {progress.reposCreated}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Skills created:</span>{" "}
          <span className="font-medium text-emerald-600">
            {progress.skillsCreated}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Repos updated:</span>{" "}
          <span className="font-medium text-blue-600">
            {progress.reposUpdated}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Install counts:</span>{" "}
          <span className="font-medium text-blue-600">
            {progress.installCountsUpdated}
          </span>
        </div>
      </div>
    </div>
  );
}

function AutoPopulateSection({
  importUrl,
  setImportUrl,
  isImportingUrl,
  isSyncingFromSkillsSh,
  isSyncingRepos,
  isSyncingMetadata,
  isSyncingContent,
  importResults,
  syncProgress,
  onImportFromUrl,
  onSyncFromSkillsSh,
  onSyncRepos,
  onSyncMetadata,
  onSyncContent,
  onResetSyncProgress,
}: AutoPopulateSectionProps) {
  const isAnySyncing =
    isImportingUrl ||
    isSyncingFromSkillsSh ||
    isSyncingRepos ||
    isSyncingMetadata ||
    isSyncingContent;
  const isSyncActive =
    syncProgress?.status === "fetching" ||
    syncProgress?.status === "processing";
  const isSyncCompleted = syncProgress?.status === "completed";
  const isSyncError = syncProgress?.status === "error";

  const getSyncBorderClass = () => {
    if (isSyncActive) {
      return "border-blue-500/30 bg-blue-500/10";
    }
    if (isSyncCompleted) {
      return "border-emerald-500/30 bg-emerald-500/10";
    }
    if (isSyncError) {
      return "border-red-500/30 bg-red-500/10";
    }
    return "border-blue-500/20 bg-blue-500/5";
  };

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
              disabled={isAnySyncing || isSyncActive}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isAnySyncing && !isSyncActive) {
                  onImportFromUrl();
                }
              }}
              placeholder="https://github.com/owner/repo"
              type="url"
              value={importUrl}
            />
            <button
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAnySyncing || isSyncActive || !importUrl.trim()}
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

        <div className={`rounded-xl border p-4 ${getSyncBorderClass()}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-foreground text-sm">
                Sync from skills.sh
              </span>
            </div>
            {(isSyncCompleted || isSyncError) && (
              <button
                className="text-muted-foreground text-xs hover:text-foreground"
                onClick={onResetSyncProgress}
                type="button"
              >
                Reset
              </button>
            )}
          </div>
          <p className="mb-3 text-muted-foreground text-xs">
            Sync skills from skills.sh in 3 steps. Run each step sequentially or
            only the step you need.
          </p>

          {/* Three step buttons */}
          <div className="space-y-2">
            {/* Step 1: Sync Repos */}
            <button
              className="flex w-full items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-sm transition-colors hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAnySyncing || isSyncActive}
              onClick={onSyncRepos}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-medium text-white text-xs">
                  1
                </span>
                <span className="font-medium text-foreground">Sync Repos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  Fetch GitHub repos from skills.sh
                </span>
                {isSyncingRepos ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <Github className="h-4 w-4 text-blue-500" />
                )}
              </div>
            </button>

            {/* Step 2: Sync Skills Metadata */}
            <button
              className="flex w-full items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/5 px-4 py-2.5 text-sm transition-colors hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAnySyncing || isSyncActive}
              onClick={onSyncMetadata}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 font-medium text-white text-xs">
                  2
                </span>
                <span className="font-medium text-foreground">
                  Sync Skills Metadata
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  Create skills with install counts
                </span>
                {isSyncingMetadata ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                ) : (
                  <Database className="h-4 w-4 text-purple-500" />
                )}
              </div>
            </button>

            {/* Step 3: Sync Skills Content */}
            <button
              className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAnySyncing || isSyncActive}
              onClick={onSyncContent}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 font-medium text-white text-xs">
                  3
                </span>
                <span className="font-medium text-foreground">
                  Sync Skills Content
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  Fetch markdown from GitHub
                </span>
                {isSyncingContent ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                ) : (
                  <Download className="h-4 w-4 text-emerald-500" />
                )}
              </div>
            </button>
          </div>

          {/* Full sync button (legacy, optional) */}
          <div className="mt-3 border-border border-t pt-3">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAnySyncing || isSyncActive}
              onClick={onSyncFromSkillsSh}
              type="button"
            >
              {isSyncingFromSkillsSh ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Full Sync (All Steps)
            </button>
          </div>

          {syncProgress && (isSyncActive || isSyncCompleted || isSyncError) && (
            <div className="mt-3">
              <SyncProgressUI progress={syncProgress} />
            </div>
          )}
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
  if (status === "updated") {
    return "text-blue-600";
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
          {summary.updated !== undefined && summary.updated > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <RefreshCw className="h-3 w-3" />
              {summary.updated} updated
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
                {summary.installCountsUpdated} installs updated
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
