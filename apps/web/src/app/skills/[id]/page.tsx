"use client";

import type { Id } from "@skills-agent-library/backend/convex/_generated/dataModel";
import { use } from "react";

import { SkillDetailView } from "@/features/skills";

interface SkillPageProps {
  params: Promise<{ id: string }>;
}

export default function SkillPage({ params }: SkillPageProps) {
  const { id } = use(params);

  return <SkillDetailView skillId={id as Id<"skills">} />;
}
