import type { AIScore } from "./types";

export function calculateAIScore(markdown: string, tags: string[]): AIScore {
  const hasCode = markdown.includes("```");
  const hasLists = markdown.includes("- ");
  const contentLength = markdown.length;

  const clarity = Math.min(
    95,
    60 + Math.floor(contentLength / 50) + (hasCode ? 10 : 0)
  );
  const usefulness = Math.min(
    95,
    55 + Math.floor(contentLength / 40) + (hasLists ? 15 : 0)
  );
  const completeness = Math.min(95, 50 + tags.length * 5);
  const overall = Math.round((clarity + usefulness + completeness) / 3);

  return { overall, clarity, usefulness, completeness };
}
