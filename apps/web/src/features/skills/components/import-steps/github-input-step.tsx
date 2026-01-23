"use client";

import { AlertCircle, Eye, FolderGit2, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface GitHubInputStepProps {
  urlInput: string;
  isLoading: boolean;
  progressMessage: string;
  error: string | null;
  onUrlInputChange: (value: string) => void;
  onFetchPreview: () => void;
}

export function GitHubInputStep({
  urlInput,
  isLoading,
  progressMessage,
  error,
  onUrlInputChange,
  onFetchPreview,
}: GitHubInputStepProps) {
  const isSubmitDisabled = isLoading || !urlInput;

  return (
    <>
      {/* URL Input */}
      <div className="mb-12 space-y-3">
        <input
          className="w-full rounded-xl border border-border bg-muted/50 px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
          disabled={isLoading}
          onChange={(e) => onUrlInputChange(e.target.value)}
          placeholder="https://github.com/owner/repo or direct SKILL.md URL"
          type="url"
          value={urlInput}
        />
        <p className="flex items-center gap-2 text-muted-foreground text-xs">
          <FolderGit2 className="h-3.5 w-3.5" />
          Enter a repository URL to import all SKILL.md files, or a direct file
          link
        </p>
      </div>

      {/* Progress Message */}
      {progressMessage && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-4 py-3 text-blue-500 text-sm"
          initial={{ opacity: 0, y: -10 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {progressMessage}
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-destructive text-sm"
          initial={{ opacity: 0, y: -10 }}
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}

      {/* Preview Button */}
      <button
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 font-medium text-background hover:scale-101 active:scale-99 disabled:opacity-50"
        disabled={isSubmitDisabled}
        onClick={onFetchPreview}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Fetching...
          </>
        ) : (
          <>
            <Eye className="h-5 w-5" />
            Preview Skills
          </>
        )}
      </button>
    </>
  );
}
