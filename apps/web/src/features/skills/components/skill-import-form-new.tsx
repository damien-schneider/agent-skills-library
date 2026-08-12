"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import {
  type ParsedSkill,
  parseSkillMarkdown,
  type ValidationResult,
  validateParsedSkill,
} from "@skills-agent-library/skills-core/skill-parser";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useAuthClient } from "@/shared/lib/auth-client";
import { calculateAIScore, getRandomSkillColor } from "../lib";
import {
  type FetchedSkill,
  fetchAllSkillsFromRepo,
  fetchSkillFromUrl,
  isDirectFileUrl,
  isRepoUrl,
} from "../lib/github-fetcher";
import { ImportInputStep } from "./import-steps/import-input-step";
import { ImportPreviewStep } from "./import-steps/import-preview-step";
import { ImportResultsStep } from "./import-steps/import-results-step";

export type ImportMode = "url" | "paste";
export type Step = "input" | "preview" | "results";

export interface PreviewSkill {
  skill: FetchedSkill | ParsedSkill;
  selected: boolean;
  validation: ValidationResult;
}

export interface ImportResult {
  success: boolean;
  name: string;
  error?: string;
}

export function SkillImportForm() {
  const { data: session } = useAuthClient.useSession();
  const createSkill = useMutation(api.skills.create);

  const [mode, setMode] = useState<ImportMode>("url");
  const [step, setStep] = useState<Step>("input");
  const [urlInput, setUrlInput] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [previewSkills, setPreviewSkills] = useState<PreviewSkill[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFetchPreview = async () => {
    setIsLoading(true);
    setError(null);
    setProgressMessage("");

    try {
      if (mode === "paste") {
        const parsed = parseSkillMarkdown(pasteInput);
        const validation = validateParsedSkill(parsed);
        setPreviewSkills([{ skill: parsed, selected: true, validation }]);
        setStep("preview");
      } else {
        await fetchUrlPreview();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch preview");
    } finally {
      setIsLoading(false);
      setProgressMessage("");
    }
  };

  const fetchUrlPreview = async () => {
    let skills: FetchedSkill[];

    if (isDirectFileUrl(urlInput)) {
      setProgressMessage("Fetching skill file...");
      const skill = await fetchSkillFromUrl(urlInput);
      skills = [skill];
    } else if (isRepoUrl(urlInput)) {
      skills = await fetchAllSkillsFromRepo(urlInput, setProgressMessage);
    } else {
      throw new Error(
        "Invalid URL. Please provide a GitHub repository or file URL."
      );
    }

    const previews: PreviewSkill[] = skills.map((skill) => ({
      skill,
      selected: true,
      // Use pre-computed validation if available, otherwise compute it
      validation:
        skill.validation ??
        validateParsedSkill(skill, { sourcePath: skill.sourcePath }),
    }));

    setPreviewSkills(previews);
    setStep("preview");
  };

  const toggleSkillSelection = (index: number) => {
    setPreviewSkills((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const selectAll = () => {
    setPreviewSkills((prev) =>
      prev.map((item) => ({ ...item, selected: true }))
    );
  };

  const deselectAll = () => {
    setPreviewSkills((prev) =>
      prev.map((item) => ({ ...item, selected: false }))
    );
  };

  const handleImport = async () => {
    setIsLoading(true);
    setError(null);

    const selectedSkills = previewSkills.filter(
      (p) => p.selected && p.validation.valid
    );
    const importResults: ImportResult[] = [];

    for (const { skill } of selectedSkills) {
      try {
        await saveSkill(skill);
        importResults.push({ success: true, name: skill.name });
      } catch (err) {
        importResults.push({
          success: false,
          name: skill.name,
          error: err instanceof Error ? err.message : "Failed to save",
        });
      }
    }

    setResults(importResults);
    setStep("results");
    setIsLoading(false);
  };

  const saveSkill = async (skill: FetchedSkill | ParsedSkill) => {
    const aiScore = calculateAIScore(
      skill.markdown,
      skill.metadata?.tags ?? []
    );

    // Extract source info if available (FetchedSkill)
    const sourceUrl = "sourceUrl" in skill ? skill.sourceUrl : undefined;
    const sourcePath = "sourcePath" in skill ? skill.sourcePath : undefined;

    await createSkill({
      name: skill.name,
      description: skill.description,
      authorId: session?.user?.id,
      authorName: skill.metadata?.author || session?.user?.name || "Anonymous",
      markdown: skill.markdown,
      tags: skill.metadata?.tags ?? [],
      color: getRandomSkillColor(),
      aiScore,
      // Extended metadata fields
      version: skill.metadata?.version,
      license: skill.metadata?.license,
      compatibility: skill.metadata?.compatibility,
      allowedTools: skill.metadata?.allowedTools,
      // Source provenance
      sourceUrl,
      sourcePath,
    });
  };

  const handleReset = () => {
    setStep("input");
    setPreviewSkills([]);
    setResults([]);
    setUrlInput("");
    setPasteInput("");
    setError(null);
  };

  if (step === "input") {
    return (
      <ImportInputStep
        error={error}
        isLoading={isLoading}
        mode={mode}
        onFetchPreview={handleFetchPreview}
        onModeChange={setMode}
        onPasteInputChange={setPasteInput}
        onUrlInputChange={setUrlInput}
        pasteInput={pasteInput}
        progressMessage={progressMessage}
        urlInput={urlInput}
      />
    );
  }

  if (step === "preview") {
    return (
      <ImportPreviewStep
        isLoading={isLoading}
        onDeselectAll={deselectAll}
        onImport={handleImport}
        onReset={handleReset}
        onSelectAll={selectAll}
        onToggleSelection={toggleSkillSelection}
        previewSkills={previewSkills}
      />
    );
  }

  return <ImportResultsStep onReset={handleReset} results={results} />;
}
