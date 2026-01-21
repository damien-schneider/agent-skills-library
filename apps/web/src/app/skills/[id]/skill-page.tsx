"use client";

import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";

import { SkillDetailView } from "@/features/skills";

interface SkillClientPageProps {
  skillId: string;
}

export function SkillClientPage({ skillId }: SkillClientPageProps) {
  return <SkillDetailView skillId={skillId as Id<"skills">} />;
}
