"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ClipboardPaste,
  FileUp,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuthClient } from "@/shared/lib/auth-client";

import { getRandomSkillColor } from "../lib";
import {
  type ParsedSkill,
  parseSkillMarkdown,
  type ValidationResult,
  validateParsedSkill,
} from "../lib/skill-parser";
import { MarkdownPreview } from "./skill-preview-sections";

type ViewState = "input" | "preview";

interface SkillPasteDropViewProps {
  isActive?: boolean;
}

export function SkillPasteDropView({
  isActive = true,
}: SkillPasteDropViewProps) {
  const router = useRouter();
  const { data: session } = useAuthClient.useSession();
  const createSkill = useMutation(api.skills.create);

  const [viewState, setViewState] = useState<ViewState>("input");
  const [content, setContent] = useState("");
  const [parsedSkill, setParsedSkill] = useState<ParsedSkill | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process content to parse and validate
  const processContent = useCallback((rawContent: string) => {
    if (!rawContent.trim()) {
      setError(null);
      setParsedSkill(null);
      setValidation(null);
      setViewState("input");
      return;
    }

    try {
      const parsed = parseSkillMarkdown(rawContent);
      const validationResult = validateParsedSkill(parsed);

      setParsedSkill(parsed);
      setValidation(validationResult);
      setError(null);
      setViewState("preview");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse skill content"
      );
      setParsedSkill(null);
      setValidation(null);
    }
  }, []);

  // Handle file reading
  const handleFileContent = useCallback(
    (fileContent: string) => {
      setContent(fileContent);
      processContent(fileContent);
    },
    [processContent]
  );

  // Handle drag events for file drop
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the window
    if (e.relatedTarget === null) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (
          file.name.endsWith(".md") ||
          file.name.endsWith(".markdown") ||
          file.type === "text/markdown" ||
          file.type === "text/plain"
        ) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const text = event.target?.result;
            if (typeof text === "string") {
              handleFileContent(text);
            }
          };
          reader.onerror = () => {
            setError("Failed to read file");
          };
          reader.readAsText(file);
        } else {
          setError("Please drop a markdown (.md) file");
        }
      }
    },
    [handleFileContent]
  );

  // Handle paste events globally
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      // Only intercept if we're in input view and not focused on a text input
      const activeElement = document.activeElement;
      const isInTextArea =
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement?.tagName === "INPUT" &&
          (activeElement as HTMLInputElement).type === "text");

      if (viewState === "input" && !isInTextArea && e.clipboardData) {
        const pastedText = e.clipboardData.getData("text");
        if (pastedText) {
          e.preventDefault();
          handleFileContent(pastedText);
        }
      }
    },
    [viewState, handleFileContent]
  );

  // Set up global event listeners (only when active)
  useEffect(() => {
    if (!isActive) {
      return;
    }

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("paste", handlePaste);
    };
  }, [
    isActive,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
  ]);

  // Handle manual text input in textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
  };

  // Handle preview button click
  const handlePreview = () => {
    processContent(content);
  };

  // Reset to input view
  const handleReset = () => {
    setViewState("input");
    setContent("");
    setParsedSkill(null);
    setValidation(null);
    setError(null);
  };

  // Generate frontmatter for preview
  const generateFrontmatter = useCallback(() => {
    if (!parsedSkill) {
      return "";
    }
    return `---
name: "${parsedSkill.name}"
description: "${parsedSkill.description}"
author: "${parsedSkill.metadata?.author || session?.user?.name || "Anonymous"}"
tags: [${(parsedSkill.metadata?.tags ?? []).map((t) => `"${t}"`).join(", ")}]
---`;
  }, [parsedSkill, session?.user?.name]);

  // Handle publish
  const handlePublish = async () => {
    if (!(parsedSkill && validation?.valid)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createSkill({
        name: parsedSkill.name,
        description: parsedSkill.description,
        authorId: session?.user?.id,
        authorName:
          parsedSkill.metadata?.author || session?.user?.name || "Anonymous",
        markdown: parsedSkill.markdown,
        tags: parsedSkill.metadata?.tags ?? [],
        color: getRandomSkillColor(),
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish skill");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy markdown to clipboard
  const copyToClipboard = async () => {
    if (!parsedSkill) {
      return;
    }
    const fullMarkdown = `${generateFrontmatter()}\n\n${parsedSkill.markdown}`;
    await navigator.clipboard.writeText(fullMarkdown);
  };

  return (
    <>
      {/* Global drag overlay */}
      {isDragOver && (
        <motion.div
          animate={{ opacity: 1 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 backdrop-blur-sm"
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-4 rounded-3xl border-4 border-foreground/40 border-dashed bg-card/90 px-16 py-12"
            initial={{ scale: 0.9 }}
          >
            <FileUp className="h-16 w-16 text-foreground/60" />
            <p className="font-medium text-foreground text-xl">
              Drop your markdown file here
            </p>
            <p className="text-muted-foreground text-sm">
              .md or .markdown files supported
            </p>
          </motion.div>
        </motion.div>
      )}

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {viewState === "input" ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
          >
            {/* Drop zone / Text area */}
            <div className="relative">
              <textarea
                className="h-64 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                onChange={handleTextareaChange}
                placeholder={`---
name: "my-skill"
description: "A brief description of what this skill does"
author: "Your Name"
tags: ["typescript", "react"]
---

# My Skill

Instructions and content go here...`}
                value={content}
              />
              <div className="absolute top-3 right-3 flex items-center gap-2 text-muted-foreground text-xs">
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>Paste anywhere or drag & drop</span>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-destructive text-sm"
                initial={{ opacity: 0, y: -10 }}
              >
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Preview button */}
            <button
              className="mt-12 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 font-medium text-background transition-transform hover:scale-102 active:scale-98 disabled:opacity-50"
              disabled={!content.trim()}
              onClick={handlePreview}
              type="button"
            >
              <Sparkles className="h-5 w-5" />
              Parse & Preview
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* Left column - Skill details */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 lg:col-span-3"
              initial={{ opacity: 0, y: 20 }}
            >
              <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm">
                {/* Header with back button */}
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">
                        Skill Parsed Successfully
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Review the details below before publishing
                      </p>
                    </div>
                  </div>
                  <button
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={handleReset}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                    Start Over
                  </button>
                </div>

                {/* Parsed skill info */}
                {parsedSkill && (
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase tracking-wider">
                        Name
                      </span>
                      <p className="font-semibold text-foreground text-xl">
                        {parsedSkill.name}
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase tracking-wider">
                        Description
                      </span>
                      <p className="text-foreground">
                        {parsedSkill.description}
                      </p>
                    </div>

                    {/* Tags */}
                    {parsedSkill.metadata?.tags &&
                      parsedSkill.metadata.tags.length > 0 && (
                        <div>
                          <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Tags
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {parsedSkill.metadata.tags.map((tag) => (
                              <span
                                className="rounded-lg bg-muted px-3 py-1 text-muted-foreground text-sm"
                                key={tag}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 border-border border-t pt-4">
                      {parsedSkill.metadata?.author && (
                        <div>
                          <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Author
                          </span>
                          <p className="text-foreground text-sm">
                            {parsedSkill.metadata.author}
                          </p>
                        </div>
                      )}
                      {parsedSkill.metadata?.version && (
                        <div>
                          <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Version
                          </span>
                          <p className="text-foreground text-sm">
                            {parsedSkill.metadata.version}
                          </p>
                        </div>
                      )}
                      {parsedSkill.metadata?.license && (
                        <div>
                          <span className="mb-1 block font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            License
                          </span>
                          <p className="text-foreground text-sm">
                            {parsedSkill.metadata.license}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Validation messages */}
                    {validation && (
                      <div className="space-y-2 border-border border-t pt-4">
                        {validation.errors.length > 0 && (
                          <div className="rounded-xl bg-destructive/10 px-4 py-3">
                            <p className="mb-1 font-medium text-destructive text-sm">
                              Validation Errors:
                            </p>
                            <ul className="list-inside list-disc text-destructive/80 text-sm">
                              {validation.errors.map((err) => (
                                <li key={err}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {validation.warnings.length > 0 && (
                          <div className="rounded-xl bg-amber-500/10 px-4 py-3">
                            <p className="mb-1 font-medium text-amber-500 text-sm">
                              Warnings:
                            </p>
                            <ul className="list-inside list-disc text-amber-500/80 text-sm">
                              {validation.warnings.map((warn) => (
                                <li key={warn}>{warn}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-destructive text-sm"
                    initial={{ opacity: 0, y: -10 }}
                  >
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </motion.div>
                )}

                {/* Publish button */}
                <motion.button
                  className="mt-6 w-full rounded-2xl bg-foreground py-4 font-medium text-background text-lg shadow-foreground/10 shadow-lg disabled:opacity-50"
                  disabled={isSubmitting || !validation?.valid}
                  onClick={handlePublish}
                  type="button"
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        Publish Skill
                      </>
                    )}
                  </span>
                </motion.button>
              </div>
            </motion.div>

            {/* Right column - Preview */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 lg:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
            >
              {parsedSkill && (
                <MarkdownPreview
                  frontmatter={generateFrontmatter()}
                  markdown={parsedSkill.markdown}
                  onCopyToClipboard={copyToClipboard}
                />
              )}
            </motion.div>
          </div>
        )}
      </main>
    </>
  );
}
