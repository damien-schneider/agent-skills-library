"use client";

import {
  AlertCircle,
  Eye,
  FileText,
  FolderGit2,
  Link2,
  Loader2,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";

import type { ImportMode } from "../skill-import-form-new";

interface ImportInputStepProps {
  mode: ImportMode;
  urlInput: string;
  pasteInput: string;
  isLoading: boolean;
  progressMessage: string;
  error: string | null;
  onModeChange: (mode: ImportMode) => void;
  onUrlInputChange: (value: string) => void;
  onPasteInputChange: (value: string) => void;
  onFetchPreview: () => void;
}

export function ImportInputStep({
  mode,
  urlInput,
  pasteInput,
  isLoading,
  progressMessage,
  error,
  onModeChange,
  onUrlInputChange,
  onPasteInputChange,
  onFetchPreview,
}: ImportInputStepProps) {
  const isSubmitDisabled =
    isLoading ||
    (mode === "url" && !urlInput) ||
    (mode === "paste" && !pasteInput);

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
          <Upload className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">
            Import Skill
          </h3>
          <p className="text-muted-foreground text-sm">
            Add skills from GitHub or paste content directly
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all ${
            mode === "url"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => onModeChange("url")}
          type="button"
        >
          <Link2 className="h-4 w-4" />
          From URL
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all ${
            mode === "paste"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => onModeChange("paste")}
          type="button"
        >
          <FileText className="h-4 w-4" />
          Paste Content
        </button>
      </div>

      {/* URL Input */}
      {mode === "url" && (
        <div className="space-y-3">
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
            Enter a repository URL to import all SKILL.md files, or a direct
            file link
          </p>
        </div>
      )}

      {/* Paste Input */}
      {mode === "paste" && (
        <div className="space-y-3">
          <textarea
            className="h-48 w-full resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
            disabled={isLoading}
            onChange={(e) => onPasteInputChange(e.target.value)}
            placeholder="Paste your SKILL.md content here..."
            value={pasteInput}
          />
        </div>
      )}

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
    </div>
  );
}
