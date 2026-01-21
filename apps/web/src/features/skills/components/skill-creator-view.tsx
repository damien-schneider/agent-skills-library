"use client";

import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { z } from "zod";

import { FieldError } from "@/shared/components/ui/field-error";
import { useAuthClient } from "@/shared/lib/auth-client";
import { parseFieldErrors } from "@/shared/lib/errors";

import { getRandomSkillColor, initialFormData } from "../lib";
import type { SkillFormData } from "../lib/types";
import {
  AdvancedFieldsSection,
  BasicInfoSection,
  ContentSection,
} from "./skill-form-sections";
import { MarkdownPreview } from "./skill-preview-sections";

const skillSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters long"),
  tags: z.array(z.string()),
  content: z.string().min(10, "Content must be at least 10 characters long"),
  license: z.string(),
  compatibility: z.string(),
  allowedTools: z.string(),
  customMetadata: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
});

interface SkillCreatorViewProps {
  showHeader?: boolean;
}

export function SkillCreatorView({ showHeader = true }: SkillCreatorViewProps) {
  const router = useRouter();
  const { data: session } = useAuthClient.useSession();
  const createSkill = useMutation(api.skills.create);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    defaultValues: initialFormData,
    validators: {
      onChange: skillSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      try {
        await createSkill({
          name: value.name,
          description: value.description,
          authorId: session?.user?.id,
          authorName: session?.user?.name || "Anonymous",
          markdown: value.content,
          tags: value.tags,
          color: getRandomSkillColor(),
        });

        router.push("/");
      } catch (error) {
        const fieldErrors = parseFieldErrors(error);
        // Map server errors back to tanstack form if possible
        if (fieldErrors.submit) {
          // biome-ignore lint/suspicious/noExplicitAny: TanStack form error map typing is complex
          (form.setErrorMap as any)({
            onSubmit: fieldErrors.submit,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const generateFrontmatter = useCallback(
    (data: SkillFormData) => {
      const lines = [
        "---",
        `name: "${data.name || "Untitled Skill"}"`,
        `description: "${data.description}"`,
        `author: "${session?.user?.name || "Anonymous"}"`,
        `tags: [${data.tags.map((t) => `"${t}"`).join(", ")}]`,
      ];

      // Add optional fields only if they have values
      if (data.license) {
        lines.push(`license: ${data.license}`);
      }
      if (data.compatibility) {
        lines.push(`compatibility: ${data.compatibility}`);
      }
      if (data.allowedTools) {
        lines.push(`allowed-tools: ${data.allowedTools}`);
      }

      // Add custom metadata fields
      if (data.customMetadata.length > 0) {
        lines.push("metadata:");
        for (const field of data.customMetadata) {
          if (field.key && field.value) {
            lines.push(`  ${field.key}: "${field.value}"`);
          }
        }
      }

      lines.push("---");
      return lines.join("\n");
    },
    [session?.user?.name]
  );

  const generateMarkdown = useCallback((data: SkillFormData) => {
    // If content is HTML from TipTap, strip tags for plain markdown preview
    // The actual content is stored as HTML
    return `# ${data.name || "Untitled Skill"}\n\n${data.content}`;
  }, []);

  const getFullMarkdown = useCallback(() => {
    const value = form.state.values;
    return `${generateFrontmatter(value)}\n\n${generateMarkdown(value)}`;
  }, [form.state.values, generateFrontmatter, generateMarkdown]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(getFullMarkdown());
  };

  return (
    <div className={showHeader ? "min-h-screen bg-background" : ""}>
      {showHeader && (
        <div className="px-6 pt-32 pb-12">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
          >
            <h1
              className="mb-4 text-4xl text-foreground md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Create a new <span className="italic">skill</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Share your knowledge with the community
            </p>
          </motion.div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 lg:col-span-3"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.1 }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              <div className="space-y-6">
                <BasicInfoSection form={form} />

                <AdvancedFieldsSection form={form} />

                <ContentSection form={form} />

                <form.Subscribe selector={(state) => [state.errorMap]}>
                  {([errorMap]) => <FieldError error={errorMap.onSubmit} />}
                </form.Subscribe>

                <motion.button
                  className="w-full rounded-2xl bg-foreground py-4 font-medium text-background text-lg shadow-foreground/10 shadow-lg disabled:opacity-50"
                  disabled={isSubmitting}
                  type="submit"
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
            </form>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2 }}
          >
            <form.Subscribe selector={(state) => state.values}>
              {(values) => (
                <MarkdownPreview
                  frontmatter={generateFrontmatter(values)}
                  markdown={generateMarkdown(values)}
                  onCopyToClipboard={copyToClipboard}
                />
              )}
            </form.Subscribe>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
