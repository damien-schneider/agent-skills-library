"use client";

import { motion } from "framer-motion";
import { FileText, Github, Upload } from "lucide-react";
import { useState } from "react";
import {
  SkillCreatorView,
  SkillGitHubImport,
  SkillPasteDropView,
} from "@/features/skills";

type CreationMode = "paste" | "github" | "create";

const MODE_OPTIONS = [
  {
    id: "paste" as const,
    label: "Paste or Drop",
    icon: Upload,
    description: "Paste content or drop a .md file",
  },
  {
    id: "github" as const,
    label: "From GitHub",
    icon: Github,
    description: "Import from a GitHub repository",
  },
  {
    id: "create" as const,
    label: "Create Manually",
    icon: FileText,
    description: "Write from scratch",
  },
];

export default function NewSkillPage() {
  const [mode, setMode] = useState<CreationMode>("paste");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50/80 to-white">
      <div className="px-6 pt-32 pb-8">
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
            Add a new <span className="italic">skill</span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Share your knowledge with the community
          </p>

          {/* Mode Toggle */}
          <div className="mx-auto flex max-w-2xl gap-2">
            {MODE_OPTIONS.map((option) => (
              <button
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-4 py-3 transition-all ${
                  mode === option.id
                    ? "bg-foreground text-background"
                    : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
                }`}
                key={option.id}
                onClick={() => setMode(option.id)}
                type="button"
              >
                <option.icon className="h-5 w-5" />
                <span className="font-medium text-sm">{option.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Keep all views mounted to preserve state, hide inactive ones */}
      <div className={mode === "paste" ? "block" : "hidden"}>
        <SkillPasteDropView isActive={mode === "paste"} />
      </div>
      <div className={mode === "github" ? "block" : "hidden"}>
        <main className="mx-auto max-w-2xl px-6 pb-24">
          <SkillGitHubImport />
        </main>
      </div>
      <div className={mode === "create" ? "block" : "hidden"}>
        <SkillCreatorView showHeader={false} />
      </div>
    </div>
  );
}
