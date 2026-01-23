"use client";

import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";

import { SkillDetailView } from "@/features/skills/components/skill-detail-view";

interface SkillClientPageProps {
  skillId: Id<"skills">;
}

export function SkillClientPage({ skillId }: SkillClientPageProps) {
  return <SkillDetailView skillId={skillId} />;
}
