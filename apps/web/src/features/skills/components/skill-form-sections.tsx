"use client";

import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { FieldError } from "@/shared/components/ui/field-error";
import { MarkdownEditor } from "@/shared/components/ui/markdown-editor";

import type { CustomMetadataField } from "../lib/types";

// Field state type for TanStack Form fields
interface FieldState<T> {
  value: T;
  meta: {
    errors: string[];
    isTouched: boolean;
  };
}

interface BaseField<T> {
  name: string;
  state: FieldState<T>;
  handleChange: (value: T) => void;
  handleBlur: () => void;
}

interface ArrayField<T> extends BaseField<T[]> {
  pushValue: (value: T) => void;
  removeValue: (index: number) => void;
}

interface BasicInfoSectionProps {
  // biome-ignore lint/suspicious/noExplicitAny: Complex FormApi generic type
  form: any;
}

export function BasicInfoSection({ form }: BasicInfoSectionProps) {
  const [tagInput, setTagInput] = useState("");

  const addTag = (tags: string[]) => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      form.setFieldMeta("tags", (prev: Record<string, unknown>) => ({
        ...prev,
        isTouched: true,
      }));
      form.pushFieldValue("tags", tagInput.trim());
      setTagInput("");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
      <h2 className="mb-6 font-semibold text-foreground text-xl">
        Basic Information
      </h2>

      <div className="space-y-5">
        <form.Field name="name">
          {(field: BaseField<string>) => (
            <div>
              <label
                className="mb-2 block font-medium text-muted-foreground text-sm"
                htmlFor={field.name}
              >
                Skill Name
              </label>
              <input
                className={`w-full rounded-2xl border-none bg-muted px-5 py-3.5 text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20 ${
                  field.state.meta.errors.length > 0
                    ? "ring-2 ring-destructive/20"
                    : ""
                }`}
                id={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g., Component Architecture Patterns"
                type="text"
                value={field.state.value}
              />
              <FieldError error={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="description">
          {(field: BaseField<string>) => (
            <div>
              <label
                className="mb-2 block font-medium text-muted-foreground text-sm"
                htmlFor={field.name}
              >
                Description
              </label>
              <textarea
                className={`w-full resize-none rounded-2xl border-none bg-muted px-5 py-3.5 text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20 ${
                  field.state.meta.errors.length > 0
                    ? "ring-2 ring-destructive/20"
                    : ""
                }`}
                id={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Brief description of what this skill teaches..."
                rows={3}
                value={field.state.value}
              />
              <FieldError error={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="tags">
          {(field: ArrayField<string>) => (
            <div>
              <label
                className="mb-2 block font-medium text-muted-foreground text-sm"
                htmlFor={field.name}
              >
                Tags
              </label>
              <div className="mb-3 flex flex-wrap gap-2">
                <AnimatePresence>
                  {field.state.value.map((tag: string, index: number) => (
                    <motion.span
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-muted-foreground text-sm"
                      exit={{ opacity: 0, scale: 0.8 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      key={tag}
                    >
                      {tag}
                      <button
                        className="transition-colors hover:text-foreground"
                        onClick={() => field.removeValue(index)}
                        type="button"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-2xl border-none bg-muted px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  id={field.name}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(field.state.value);
                    }
                  }}
                  placeholder="Add a tag..."
                  type="text"
                  value={tagInput}
                />
                <button
                  className="rounded-2xl bg-muted px-4 py-3 transition-colors hover:scale-102 hover:bg-muted/80 active:scale-98"
                  onClick={() => addTag(field.state.value)}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <FieldError error={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>
    </div>
  );
}

interface ContentSectionProps {
  // biome-ignore lint/suspicious/noExplicitAny: Complex FormApi generic type
  form: any;
}

export function ContentSection({ form }: ContentSectionProps) {
  return (
    <form.Field name="content">
      {(field: BaseField<string>) => (
        <div>
          <MarkdownEditor
            hasError={field.state.meta.errors.length > 0}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value)}
            placeholder="Write your skill content using the toolbar above. Use headings, lists, code blocks, and more to structure your content..."
            value={field.state.value}
          />
          <FieldError error={field.state.meta.errors} />
        </div>
      )}
    </form.Field>
  );
}

interface AdvancedFieldsSectionProps {
  // biome-ignore lint/suspicious/noExplicitAny: Complex FormApi generic type
  form: any;
}

export function AdvancedFieldsSection({ form }: AdvancedFieldsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newMetaKey, setNewMetaKey] = useState("");
  const [newMetaValue, setNewMetaValue] = useState("");

  const addCustomField = (currentFields: CustomMetadataField[]) => {
    if (newMetaKey.trim() && newMetaValue.trim()) {
      const keyExists = currentFields.some(
        (f) => f.key.toLowerCase() === newMetaKey.trim().toLowerCase()
      );
      if (!keyExists) {
        form.pushFieldValue("customMetadata", {
          key: newMetaKey.trim(),
          value: newMetaValue.trim(),
        });
        setNewMetaKey("");
        setNewMetaValue("");
      }
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm">
      <button
        className="flex w-full items-center justify-between p-8"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="text-left">
          <h2 className="font-semibold text-foreground text-xl">
            Advanced Options
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            License, compatibility, allowed tools, and custom metadata
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-5 border-border border-t px-8 pt-6 pb-8">
              {/* License Field */}
              <form.Field name="license">
                {(field: BaseField<string>) => (
                  <div>
                    <label
                      className="mb-2 block font-medium text-muted-foreground text-sm"
                      htmlFor={field.name}
                    >
                      License
                    </label>
                    <input
                      className="w-full rounded-2xl border-none bg-muted px-5 py-3.5 text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
                      id={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g., MIT, Apache-2.0, Proprietary"
                      type="text"
                      value={field.state.value}
                    />
                    <p className="mt-1.5 text-muted-foreground text-xs">
                      Specify the license for your skill (optional)
                    </p>
                    <FieldError error={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              {/* Compatibility Field */}
              <form.Field name="compatibility">
                {(field: BaseField<string>) => (
                  <div>
                    <label
                      className="mb-2 block font-medium text-muted-foreground text-sm"
                      htmlFor={field.name}
                    >
                      Compatibility
                    </label>
                    <input
                      className="w-full rounded-2xl border-none bg-muted px-5 py-3.5 text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
                      id={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g., Requires git, docker, jq"
                      type="text"
                      value={field.state.value}
                    />
                    <p className="mt-1.5 text-muted-foreground text-xs">
                      Environment requirements or intended product (optional)
                    </p>
                    <FieldError error={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              {/* Allowed Tools Field */}
              <form.Field name="allowedTools">
                {(field: BaseField<string>) => (
                  <div>
                    <label
                      className="mb-2 block font-medium text-muted-foreground text-sm"
                      htmlFor={field.name}
                    >
                      Allowed Tools
                    </label>
                    <input
                      className="w-full rounded-2xl border-none bg-muted px-5 py-3.5 font-mono text-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                      id={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g., Bash(git:*) Bash(jq:*) Read"
                      type="text"
                      value={field.state.value}
                    />
                    <p className="mt-1.5 text-muted-foreground text-xs">
                      Space-delimited list of pre-approved tools (experimental)
                    </p>
                    <FieldError error={field.state.meta.errors} />
                  </div>
                )}
              </form.Field>

              {/* Custom Metadata Fields */}
              <div className="border-border border-t pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-muted-foreground text-sm">
                      Custom Metadata
                    </h3>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Add additional key-value pairs to the frontmatter
                    </p>
                  </div>
                </div>

                <form.Field name="customMetadata">
                  {(field: ArrayField<CustomMetadataField>) => (
                    <div className="space-y-3">
                      {/* Existing custom fields */}
                      <AnimatePresence>
                        {field.state.value.map(
                          (meta: CustomMetadataField, index: number) => (
                            <motion.div
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2"
                              exit={{ opacity: 0, y: -10 }}
                              initial={{ opacity: 0, y: -10 }}
                              key={`${meta.key}-${index}`}
                            >
                              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
                                <span className="font-medium text-muted-foreground text-sm">
                                  {meta.key}:
                                </span>
                                <span className="text-foreground text-sm">
                                  {meta.value}
                                </span>
                              </div>
                              <button
                                className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:scale-105 hover:bg-destructive/10 hover:text-destructive active:scale-95"
                                onClick={() => field.removeValue(index)}
                                type="button"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </motion.div>
                          )
                        )}
                      </AnimatePresence>

                      {/* Add new field form */}
                      <div className="flex gap-2">
                        <input
                          className="w-1/3 rounded-2xl border-none bg-muted px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          onChange={(e) => setNewMetaKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomField(field.state.value);
                            }
                          }}
                          placeholder="Key"
                          type="text"
                          value={newMetaKey}
                        />
                        <input
                          className="flex-1 rounded-2xl border-none bg-muted px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          onChange={(e) => setNewMetaValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomField(field.state.value);
                            }
                          }}
                          placeholder="Value"
                          type="text"
                          value={newMetaValue}
                        />
                        <button
                          className="rounded-2xl bg-muted px-4 py-3 transition-colors hover:scale-102 hover:bg-muted/80 active:scale-98"
                          onClick={() => addCustomField(field.state.value)}
                          type="button"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
