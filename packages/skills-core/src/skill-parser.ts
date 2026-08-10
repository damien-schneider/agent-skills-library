/**
 * Skill Markdown Parser
 *
 * Parses SKILL.md files in various formats:
 * 1. Frontmatter at the top (standard YAML)
 * 2. Frontmatter at the bottom (vercel-labs style)
 * 3. Plain markdown with title extraction
 *
 * Supports both Agent Skills spec (agentskills.io) and OpenAI Codex Skills format.
 */

export interface SkillMetadata {
  author?: string;
  version?: string;
  tags?: string[];
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  /** Short user-facing description (OpenAI Codex style) */
  shortDescription?: string;
  /** Arbitrary additional metadata from frontmatter */
  extra?: Record<string, unknown>;
}

export interface ParsedSkill {
  name: string;
  description: string;
  markdown: string;
  metadata?: SkillMetadata;
}

interface FrontmatterData {
  name?: string;
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
  license?: string;
  compatibility?: string;
  "allowed-tools"?: string;
  "short-description"?: string;
  metadata?: {
    author?: string;
    version?: string;
    "short-description"?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Top-level regex patterns for performance
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;
const BOTTOM_FRONTMATTER_REGEX = /\n---\s*\n([\s\S]*?)\n---\s*$/;
const TITLE_REGEX = /^#\s+(.+)$/m;
const METADATA_FIELD_REGEX = /^(\w[\w-]*):\s*["']?(.+?)["']?$/;
const KEY_VALUE_REGEX = /^(\w[\w-]*):\s*(.*)$/;
const WHITESPACE_SPLIT_REGEX = /\s+/;

// Spec-compliant name validation pattern
// Must be lowercase alphanumeric with hyphens, no consecutive hyphens
const VALID_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

function parseMetadataField(
  trimmed: string,
  metadata: Record<string, unknown>
): void {
  const match = trimmed.match(METADATA_FIELD_REGEX);
  if (match) {
    const key = match[1] ?? "";
    const value = match[2] ?? "";
    // Map kebab-case to camelCase for common fields
    if (key === "author") {
      metadata.author = value;
    } else if (key === "version") {
      metadata.version = value;
    } else if (key === "short-description") {
      metadata.shortDescription = value;
    } else {
      // Store other fields as-is
      metadata[key] = value;
    }
  }
}

function parseKeyValue(
  key: string,
  rawValue: string,
  result: FrontmatterData
): void {
  const value = rawValue.replace(/^["']|["']$/g, "").trim();

  // Handle array syntax: [item1, item2]
  if (value.startsWith("[") && value.endsWith("]")) {
    const arrayContent = value.slice(1, -1);
    const items = arrayContent.split(",").map((item) =>
      item
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim()
    );
    if (key === "tags") {
      result.tags = items.filter(Boolean);
    } else if (key === "allowed-tools") {
      result["allowed-tools"] = items.filter(Boolean).join(" ");
    }
    return;
  }

  // Map known fields
  switch (key) {
    case "name":
      result.name = value;
      break;
    case "description":
      result.description = value;
      break;
    case "author":
      result.author = value;
      break;
    case "version":
      result.version = value;
      break;
    case "license":
      result.license = value;
      break;
    case "compatibility":
      result.compatibility = value;
      break;
    case "allowed-tools":
      // Space-delimited list per spec
      result["allowed-tools"] = value;
      break;
    case "short-description":
      result["short-description"] = value;
      break;
    default:
      // Store unknown fields for extensibility
      result[key] = value;
      break;
  }
}

function parseFrontmatter(frontmatterContent: string): FrontmatterData {
  const result: FrontmatterData = {};
  const lines = frontmatterContent.split("\n");
  let inMetadata = false;
  let metadataRecord: Record<string, unknown> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed === "metadata:") {
      inMetadata = true;
      metadataRecord = {};
      result.metadata = metadataRecord;
      continue;
    }

    if (inMetadata && line.startsWith("  ")) {
      parseMetadataField(trimmed, metadataRecord);
      continue;
    }

    if (!(line.startsWith(" ") || line.startsWith("\t"))) {
      inMetadata = false;
    }

    const keyValueMatch = trimmed.match(KEY_VALUE_REGEX);
    if (keyValueMatch) {
      parseKeyValue(keyValueMatch[1] ?? "", keyValueMatch[2] ?? "", result);
    }
  }

  return result;
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(TITLE_REGEX);
  return match?.[1]?.trim() ?? null;
}

function extractDescriptionFromMarkdown(markdown: string): string {
  // Get first paragraph after the title
  const lines = markdown.split("\n");
  let foundTitle = false;
  let description = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      foundTitle = true;
      continue;
    }

    if (foundTitle && trimmed && !trimmed.startsWith("#")) {
      description = trimmed;
      break;
    }
  }

  // Truncate if too long
  if (description.length > 500) {
    return `${description.slice(0, 497)}...`;
  }

  return description || "No description provided";
}

/** Known frontmatter keys that are handled explicitly */
const KNOWN_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "author",
  "version",
  "tags",
  "license",
  "compatibility",
  "allowed-tools",
  "short-description",
  "metadata",
]);

const KNOWN_NESTED_META_KEYS = new Set([
  "author",
  "version",
  "shortDescription",
]);

/** Extract and merge metadata from frontmatter into SkillMetadata format */
function buildSkillMetadata(frontmatter: FrontmatterData): SkillMetadata {
  const nestedMeta = frontmatter.metadata;

  const author =
    frontmatter.author ||
    (typeof nestedMeta?.author === "string" ? nestedMeta.author : undefined);
  const version =
    frontmatter.version ||
    (typeof nestedMeta?.version === "string" ? nestedMeta.version : undefined);
  const shortDescription =
    frontmatter["short-description"] ||
    (typeof nestedMeta?.shortDescription === "string"
      ? nestedMeta.shortDescription
      : undefined);

  // Parse allowed-tools from space-delimited string
  const allowedToolsRaw = frontmatter["allowed-tools"];
  const allowedTools = allowedToolsRaw
    ? allowedToolsRaw.split(WHITESPACE_SPLIT_REGEX).filter(Boolean)
    : undefined;

  // Collect extra/unknown fields
  const extra = collectExtraFields(frontmatter, nestedMeta);

  return {
    author,
    version,
    tags: frontmatter.tags,
    license: frontmatter.license,
    compatibility: frontmatter.compatibility,
    allowedTools,
    shortDescription,
    extra: Object.keys(extra).length > 0 ? extra : undefined,
  };
}

/** Collect unknown frontmatter fields into an extra record */
function collectExtraFields(
  frontmatter: FrontmatterData,
  nestedMeta?: FrontmatterData["metadata"]
): Record<string, unknown> {
  const extra: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
      extra[key] = value;
    }
  }

  if (nestedMeta) {
    for (const [key, value] of Object.entries(nestedMeta)) {
      if (!KNOWN_NESTED_META_KEYS.has(key)) {
        extra[key] = value;
      }
    }
  }

  return extra;
}

export function parseSkillMarkdown(content: string): ParsedSkill {
  let frontmatter: FrontmatterData = {};
  let cleanedMarkdown = content.trim();

  // Try to extract frontmatter from the top
  const topMatch = content.match(FRONTMATTER_REGEX);
  if (topMatch) {
    frontmatter = parseFrontmatter(topMatch[1] ?? "");
    cleanedMarkdown = content.slice(topMatch[0].length).trim();
  }

  // Try to extract frontmatter from the bottom (vercel-labs style)
  const bottomMatch = content.match(BOTTOM_FRONTMATTER_REGEX);
  if (bottomMatch) {
    const bottomFrontmatter = parseFrontmatter(bottomMatch[1] ?? "");
    // Bottom frontmatter takes precedence for name/description
    frontmatter = { ...frontmatter, ...bottomFrontmatter };
    cleanedMarkdown = content.slice(0, bottomMatch.index).trim();

    // Also check for top frontmatter that we may have missed
    const topInCleaned = cleanedMarkdown.match(FRONTMATTER_REGEX);
    if (topInCleaned) {
      cleanedMarkdown = cleanedMarkdown.slice(topInCleaned[0].length).trim();
    }
  }

  // Extract name from title if not in frontmatter
  const name =
    frontmatter.name ||
    extractTitleFromMarkdown(cleanedMarkdown) ||
    "Untitled Skill";

  // Extract description if not in frontmatter
  const description =
    frontmatter.description || extractDescriptionFromMarkdown(cleanedMarkdown);

  return {
    name,
    description,
    markdown: cleanedMarkdown,
    metadata: buildSkillMetadata(frontmatter),
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a skill name against the Agent Skills spec
 * - Must be 1-64 characters
 * - Must be lowercase alphanumeric with hyphens
 * - Cannot start/end with hyphen
 * - No consecutive hyphens
 */
export function validateSkillName(name: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!name || name.length < 1) {
    errors.push("Skill name is required");
    return { valid: false, errors, warnings };
  }

  if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Skill name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (name.length < 3) {
    errors.push("Skill name must be at least 3 characters");
  }

  // Check spec compliance (warning, not error for flexibility)
  if (!VALID_NAME_PATTERN.test(name)) {
    if (name !== name.toLowerCase()) {
      warnings.push(
        "Spec recommends lowercase names (e.g., 'my-skill' instead of 'My Skill')"
      );
    }
    if (name.includes("--")) {
      warnings.push("Spec recommends avoiding consecutive hyphens in names");
    }
    if (name.startsWith("-") || name.endsWith("-")) {
      warnings.push("Spec recommends names not start or end with hyphens");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateParsedSkill(
  skill: ParsedSkill,
  options?: { sourcePath?: string }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Name validation
  const nameValidation = validateSkillName(skill.name);
  errors.push(...nameValidation.errors);
  warnings.push(...nameValidation.warnings);

  // Check if name matches directory name (if available)
  if (options?.sourcePath) {
    const dirName = extractDirectoryName(options.sourcePath);
    if (dirName && dirName !== skill.name && dirName !== slugify(skill.name)) {
      warnings.push(
        `Spec recommends name '${skill.name}' match directory name '${dirName}'`
      );
    }
  }

  // Description validation
  if (!skill.description || skill.description.length < 10) {
    errors.push("Skill description must be at least 10 characters");
  }

  if (skill.description && skill.description.length > MAX_DESCRIPTION_LENGTH) {
    warnings.push(
      `Description exceeds spec maximum of ${MAX_DESCRIPTION_LENGTH} characters`
    );
  }

  // Content validation
  if (!skill.markdown || skill.markdown.length < 50) {
    errors.push("Skill content must be at least 50 characters");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Extract directory name from a file path like 'skills/my-skill/SKILL.md' */
function extractDirectoryName(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  // If path ends with SKILL.md, get the parent directory
  if (parts.length >= 2 && parts.at(-1)?.toLowerCase() === "skill.md") {
    return parts.at(-2) ?? null;
  }
  return null;
}

/** Convert a name to a slug for comparison */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
