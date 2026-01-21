import type {
  Doc,
  Id,
} from "@skills-agent-library/backend/convex/_generated/dataModel";

export type Skill = Doc<"skills"> & {
  votes: number;
  upvotes: number;
  downvotes: number;
  userVote?: "up" | "down" | null;
};

export type Category = Doc<"categories">;

export type SkillId = Id<"skills">;
export type CategoryId = Id<"categories">;

export interface AIScore {
  overall: number;
  clarity: number;
  usefulness: number;
  completeness: number;
}

export const skillColors = [
  "oklch(0.92 0.08 100)",
  "oklch(0.90 0.10 145)",
  "oklch(0.90 0.08 300)",
  "oklch(0.92 0.10 30)",
  "oklch(0.88 0.10 220)",
  "oklch(0.90 0.08 180)",
] as const;

export function getRandomSkillColor(): string {
  return skillColors[Math.floor(Math.random() * skillColors.length)];
}

export interface CustomMetadataField {
  key: string;
  value: string;
}

export interface SkillFormData {
  name: string;
  description: string;
  tags: string[];
  content: string;
  license: string;
  compatibility: string;
  allowedTools: string;
  customMetadata: CustomMetadataField[];
}

export interface SkillSection {
  id: string;
  title: string;
  content: string;
  type: "text" | "code" | "list";
}

export const initialFormData: SkillFormData = {
  name: "",
  description: "",
  tags: [],
  content: "",
  license: "",
  compatibility: "",
  allowedTools: "",
  customMetadata: [],
};
