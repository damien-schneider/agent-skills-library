"use client";

import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";

import { SkillDetailView } from "@/features/skills";

interface NamespaceSkillClientPageProps {
  skillId: Id<"skills">;
}

export function NamespaceSkillClientPage({
  skillId,
}: NamespaceSkillClientPageProps) {
  return <SkillDetailView skillId={skillId} />;
}
