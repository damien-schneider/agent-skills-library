"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Upload, X } from "lucide-react";

import { formatSkillName } from "@/shared/lib/utils";

import type { ImportResult } from "../skill-import-form-new";

interface ImportResultsStepProps {
  results: ImportResult[];
  onReset: () => void;
}

export function ImportResultsStep({
  results,
  onReset,
}: ImportResultsStepProps) {
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            failureCount === 0
              ? "bg-gradient-to-br from-emerald-500 to-green-600"
              : "bg-gradient-to-br from-amber-500 to-orange-600"
          }`}
        >
          {failureCount === 0 ? (
            <CheckCircle2 className="h-5 w-5 text-zinc-50" />
          ) : (
            <AlertCircle className="h-5 w-5 text-zinc-50" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">
            Import Complete
          </h3>
          <p className="text-muted-foreground text-sm">
            {successCount} imported
            {failureCount > 0 && `, ${failureCount} failed`}
          </p>
        </div>
      </div>

      {/* Results List */}
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {results.map((result, index) => (
          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
              result.success ? "bg-emerald-500/10" : "bg-destructive/10"
            }`}
            key={`${result.name}-${index}`}
          >
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <X className="h-4 w-4 text-destructive" />
              )}
              <span className="truncate font-medium text-sm">
                {formatSkillName(result.name)}
              </span>
            </div>
            {result.error && (
              <span className="ml-2 truncate text-destructive text-xs">
                {result.error}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onReset}
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Upload className="h-5 w-5" />
          Import More
        </motion.button>
      </div>
    </div>
  );
}
