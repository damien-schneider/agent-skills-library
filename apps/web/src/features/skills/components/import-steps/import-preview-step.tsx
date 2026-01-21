"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  ExternalLink,
  FileCode,
  FolderOpen,
  Loader2,
  Upload,
} from "lucide-react";

import { formatSkillName } from "@/shared/lib/utils";

import type { PreviewSkill } from "../skill-import-form-new";

interface ImportPreviewStepProps {
  previewSkills: PreviewSkill[];
  isLoading: boolean;
  onToggleSelection: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onImport: () => void;
  onReset: () => void;
}

export function ImportPreviewStep({
  previewSkills,
  isLoading,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onImport,
  onReset,
}: ImportPreviewStepProps) {
  const validSelectedCount = previewSkills.filter(
    (p) => p.selected && p.validation.valid
  ).length;
  const hasWarnings = previewSkills.some(
    (p) => p.validation.warnings && p.validation.warnings.length > 0
  );

  return (
    <div className="space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted"
            onClick={onReset}
            type="button"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h3 className="font-semibold text-foreground text-lg">
              Preview Skills
            </h3>
            <p className="text-muted-foreground text-sm">
              Select which skills to import
              {hasWarnings && " (some have spec warnings)"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted"
            onClick={onSelectAll}
            type="button"
          >
            Select all
          </button>
          <button
            className="rounded-lg px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted"
            onClick={onDeselectAll}
            type="button"
          >
            Deselect all
          </button>
        </div>
      </div>

      {/* Skills List */}
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {previewSkills.map((preview, index) => (
          <PreviewSkillCard
            index={index}
            key={`${preview.skill.name}-${index}`}
            onToggle={() => onToggleSelection(index)}
            preview={preview}
          />
        ))}
      </div>

      {/* Summary & Import Button */}
      <div className="flex items-center justify-between border-gray-100 border-t pt-4">
        <p className="text-muted-foreground text-sm">
          {validSelectedCount} of {previewSkills.length} skills selected
        </p>

        <motion.button
          className="flex items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3 font-medium text-background disabled:opacity-50"
          disabled={isLoading || validSelectedCount === 0}
          onClick={onImport}
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              Import {validSelectedCount} Skill
              {validSelectedCount !== 1 ? "s" : ""}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

interface PreviewSkillCardProps {
  preview: PreviewSkill;
  index: number;
  onToggle: () => void;
}

function PreviewSkillCard({ preview, index, onToggle }: PreviewSkillCardProps) {
  const isValid = preview.validation.valid;
  const hasWarnings =
    preview.validation.warnings && preview.validation.warnings.length > 0;
  const borderClass = preview.selected
    ? "border-foreground/20 bg-card"
    : "border-border bg-muted/50 opacity-60";
  const invalidClass = isValid ? "" : "border-destructive/20 bg-destructive/10";

  // Check if skill has source info (FetchedSkill)
  const sourcePath =
    "sourcePath" in preview.skill ? preview.skill.sourcePath : undefined;
  const sourceUrl =
    "sourceUrl" in preview.skill ? preview.skill.sourceUrl : undefined;
  const bundle = "bundle" in preview.skill ? preview.skill.bundle : undefined;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border p-4 transition-all ${borderClass} ${invalidClass}`}
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-start gap-4">
        <SelectionCheckbox
          disabled={!isValid}
          onClick={onToggle}
          selected={preview.selected}
        />

        <div className="min-w-0 flex-1">
          <SkillHeader
            license={preview.skill.metadata?.license}
            name={preview.skill.name}
            version={preview.skill.metadata?.version}
          />

          <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
            {preview.skill.description}
          </p>

          <SourceInfo sourcePath={sourcePath} sourceUrl={sourceUrl} />
          <BundleIndicator bundle={bundle} />

          {preview.skill.metadata?.tags &&
            preview.skill.metadata.tags.length > 0 && (
              <SkillTags tags={preview.skill.metadata.tags} />
            )}

          <ValidationMessages
            errors={preview.validation.errors}
            hasWarnings={hasWarnings}
            isValid={isValid}
            warnings={preview.validation.warnings}
          />
        </div>
      </div>
    </motion.div>
  );
}

function SelectionCheckbox({
  selected,
  disabled,
  onClick,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {selected && <Check className="h-4 w-4" />}
    </button>
  );
}

function SkillHeader({
  name,
  version,
  license,
}: {
  name: string;
  version?: string;
  license?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <h4 className="truncate font-semibold text-foreground">
        {formatSkillName(name)}
      </h4>
      {version && (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
          v{version}
        </span>
      )}
      {license && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
          {license}
        </span>
      )}
    </div>
  );
}

function SourceInfo({
  sourcePath,
  sourceUrl,
}: {
  sourcePath?: string;
  sourceUrl?: string;
}) {
  if (!sourcePath) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-muted-foreground text-xs">
      <FileCode className="h-3 w-3" />
      <span className="truncate font-mono">{sourcePath}</span>
      {sourceUrl && (
        <a
          className="ml-1 text-primary hover:text-primary/80"
          href={sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function BundleIndicator({
  bundle,
}: {
  bundle?: {
    hasScripts: boolean;
    hasReferences: boolean;
    hasAssets: boolean;
    additionalFiles: string[];
  };
}) {
  if (!bundle) {
    return null;
  }

  const parts: string[] = [];
  if (bundle.hasScripts) {
    parts.push("scripts/");
  }
  if (bundle.hasReferences) {
    parts.push("references/");
  }
  if (bundle.hasAssets) {
    parts.push("assets/");
  }
  if (bundle.additionalFiles.length > 0) {
    parts.push(`+${bundle.additionalFiles.length} files`);
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground text-xs">
      <FolderOpen className="h-3 w-3" />
      <span>Bundle: {parts.join(" ")}</span>
    </div>
  );
}

function ValidationMessages({
  isValid,
  hasWarnings,
  errors,
  warnings,
}: {
  isValid: boolean;
  hasWarnings: boolean;
  errors: string[];
  warnings?: string[];
}) {
  if (isValid && !hasWarnings) {
    return null;
  }

  return (
    <>
      {!isValid && (
        <div className="mt-2 flex items-center gap-1 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5" />
          {errors[0]}
        </div>
      )}
      {isValid && hasWarnings && warnings && (
        <div className="mt-2 space-y-1">
          {warnings.slice(0, 2).map((warning) => (
            <div
              className="flex items-center gap-1 text-amber-500 text-xs"
              key={warning}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{warning}</span>
            </div>
          ))}
          {warnings.length > 2 && (
            <span className="text-amber-500/80 text-xs">
              +{warnings.length - 2} more warnings
            </span>
          )}
        </div>
      )}
    </>
  );
}

function SkillTags({ tags }: { tags: string[] }) {
  const visibleTags = tags.slice(0, 5);
  const remainingCount = tags.length - 5;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
          key={tag}
        >
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="text-muted-foreground text-xs">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
