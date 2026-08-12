import {
  type AgentTool,
  getInstallPath,
  type InstallScope,
  type OperatingSystem,
} from "@skills-agent-library/skills-core/install-targets";

const GITHUB_URL_PATTERN =
  /github\.com\/([^/]+)\/([^/]+)(?:\/(?:blob|tree)\/[^/]+\/(.+))?/;
const GITHUB_URL_WITH_BRANCH_PATTERN =
  /github\.com\/([^/]+)\/([^/]+)(?:\/(?:blob|tree)\/([^/]+)\/(.+))?/;
const SKILL_MD_SUFFIX_PATTERN = /\/SKILL\.md$/;
const HEREDOC_DELIMITER = "EOF_SKILL_CONTENT";
const HEREDOC_FALLBACK_DELIMITER = "EOF__SKILL__CONTENT__MARKER";
const POWERSHELL_BACKTICK_PATTERN = /`/g;
const POWERSHELL_HERE_STRING_TERMINATOR_PATTERN = /\n"@/g;

const FLAT_FILE_TOOLS: AgentTool[] = ["cursor"];

function usesFlatFileFormat(tool: AgentTool): boolean {
  return FLAT_FILE_TOOLS.includes(tool);
}

function extractParentDirectory(filePath: string, os: OperatingSystem): string {
  const separator = os === "windows" ? "\\" : "/";
  const parts = filePath.split(separator);
  parts.pop();
  return parts.join(separator);
}

export interface CommandGenerationOptions {
  tool: AgentTool;
  scope: InstallScope;
  os: OperatingSystem;
  skillName: string;
  skillContent: string;
  sourceUrl?: string;
  hasBundle?: boolean;
}

export interface GeneratedCommand {
  command: string;
  shellType: "bash" | "powershell";
  description: string;
  warnings?: string[];
}

function escapeForBashHeredoc(content: string): string {
  if (content.includes(HEREDOC_DELIMITER)) {
    return content.replaceAll(HEREDOC_DELIMITER, HEREDOC_FALLBACK_DELIMITER);
  }
  return content;
}

function escapeForPowerShellHereString(content: string): string {
  return content
    .replace(POWERSHELL_BACKTICK_PATTERN, "``")
    .replace(POWERSHELL_HERE_STRING_TERMINATOR_PATTERN, '\n`"@');
}

function generateUnixCommand(options: CommandGenerationOptions): string {
  const { tool, scope, os, skillName, skillContent } = options;

  const installPath = getInstallPath(tool, scope, os, skillName);
  const escapedContent = escapeForBashHeredoc(skillContent);

  if (usesFlatFileFormat(tool)) {
    const parentDir = extractParentDirectory(installPath, os);
    return [
      `mkdir -p "${parentDir}"`,
      `cat << '${HEREDOC_DELIMITER}' > "${installPath}"`,
      escapedContent,
      HEREDOC_DELIMITER,
      `echo "✓ Skill '${skillName}' installed to ${installPath}"`,
    ].join("\n");
  }

  const skillFilePath = `${installPath}/SKILL.md`;
  return [
    `mkdir -p "${installPath}"`,
    `cat << '${HEREDOC_DELIMITER}' > "${skillFilePath}"`,
    escapedContent,
    HEREDOC_DELIMITER,
    `echo "✓ Skill '${skillName}' installed to ${installPath}"`,
  ].join("\n");
}

function generateWindowsCommand(options: CommandGenerationOptions): string {
  const { tool, scope, skillName, skillContent } = options;

  const installPath = getInstallPath(tool, scope, "windows", skillName);
  const escapedContent = escapeForPowerShellHereString(skillContent);

  if (usesFlatFileFormat(tool)) {
    const parentDir = extractParentDirectory(installPath, "windows");
    return [
      `New-Item -ItemType Directory -Force -Path "${parentDir}" | Out-Null`,
      `$content = @"`,
      escapedContent,
      `"@`,
      `Set-Content -Path "${installPath}" -Value $content -Encoding UTF8`,
      `Write-Host "✓ Skill '${skillName}' installed to ${installPath}" -ForegroundColor Green`,
    ].join("\n");
  }

  const skillFilePath = `${installPath}\\SKILL.md`;
  return [
    `New-Item -ItemType Directory -Force -Path "${installPath}" | Out-Null`,
    `$content = @"`,
    escapedContent,
    `"@`,
    `Set-Content -Path "${skillFilePath}" -Value $content -Encoding UTF8`,
    `Write-Host "✓ Skill '${skillName}' installed to ${installPath}" -ForegroundColor Green`,
  ].join("\n");
}

function extractSkillDirPath(filePath: string | undefined): string {
  if (!filePath) {
    return "";
  }
  const withoutSkillMd = filePath.replace(SKILL_MD_SUFFIX_PATTERN, "");
  return withoutSkillMd === filePath ? filePath : withoutSkillMd;
}

function generateGitHubCloneCommand(options: CommandGenerationOptions): string {
  const { tool, scope, os, skillName, sourceUrl } = options;

  if (!sourceUrl) {
    throw new Error("sourceUrl is required for GitHub clone commands");
  }

  const installPath = getInstallPath(tool, scope, os, skillName);
  const match = sourceUrl.match(GITHUB_URL_PATTERN);

  if (!match) {
    throw new Error("Invalid GitHub URL format");
  }

  const [, owner, repo, filePath] = match;
  const skillDirPath = extractSkillDirPath(filePath);

  if (os === "windows") {
    const lines = [
      "$tempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }",
      `git clone --depth 1 --filter=blob:none --sparse "https://github.com/${owner}/${repo}.git" $tempDir`,
      "Push-Location $tempDir",
      `git sparse-checkout set "${skillDirPath}"`,
      "Pop-Location",
      `New-Item -ItemType Directory -Force -Path "${installPath}" | Out-Null`,
      `Copy-Item -Path "$tempDir\\${skillDirPath}\\*" -Destination "${installPath}" -Recurse -Force`,
      "Remove-Item -Path $tempDir -Recurse -Force",
      `Write-Host "✓ Skill bundle '${skillName}' installed to ${installPath}" -ForegroundColor Green`,
    ];
    return lines.join("\n");
  }

  const lines = [
    "TEMP_DIR=$(mktemp -d)",
    `git clone --depth 1 --filter=blob:none --sparse "https://github.com/${owner}/${repo}.git" "$TEMP_DIR"`,
    `cd "$TEMP_DIR"`,
    `git sparse-checkout set "${skillDirPath}"`,
    "cd -",
    `mkdir -p "${installPath}"`,
    `cp -r "$TEMP_DIR/${skillDirPath}/"* "${installPath}/"`,
    `rm -rf "$TEMP_DIR"`,
    `echo "✓ Skill bundle '${skillName}' installed to ${installPath}"`,
  ];

  return lines.join("\n");
}

export function generateGitHubCLICommand(
  options: CommandGenerationOptions
): GeneratedCommand | null {
  const { sourceUrl, os, tool, scope, skillName } = options;

  if (!sourceUrl) {
    return null;
  }

  const match = sourceUrl.match(GITHUB_URL_WITH_BRANCH_PATTERN);

  if (!match) {
    return null;
  }

  const [, owner, repo, , filePath] = match;
  const installPath = getInstallPath(tool, scope, os, skillName);
  const skillDirPath = extractSkillDirPath(filePath);

  if (os === "windows") {
    const command = [
      `gh repo clone ${owner}/${repo} --depth 1 -- "$env:TEMP\\${repo}"`,
      `New-Item -ItemType Directory -Force -Path "${installPath}" | Out-Null`,
      skillDirPath
        ? `Copy-Item -Path "$env:TEMP\\${repo}\\${skillDirPath}\\*" -Destination "${installPath}" -Recurse -Force`
        : `Copy-Item -Path "$env:TEMP\\${repo}\\*" -Destination "${installPath}" -Recurse -Force`,
      `Remove-Item -Path "$env:TEMP\\${repo}" -Recurse -Force`,
      `Write-Host "✓ Skill '${skillName}' installed" -ForegroundColor Green`,
    ].join("\n");

    return {
      command,
      shellType: "powershell",
      description: "Install using GitHub CLI (requires gh to be installed)",
      warnings: ["Requires GitHub CLI (gh) to be installed and authenticated"],
    };
  }

  const command = [
    "TEMP_DIR=$(mktemp -d)",
    `gh repo clone ${owner}/${repo} "$TEMP_DIR" -- --depth 1`,
    `mkdir -p "${installPath}"`,
    skillDirPath
      ? `cp -r "$TEMP_DIR/${skillDirPath}/"* "${installPath}/"`
      : `cp -r "$TEMP_DIR/"* "${installPath}/"`,
    `rm -rf "$TEMP_DIR"`,
    `echo "✓ Skill '${skillName}' installed to ${installPath}"`,
  ].join("\n");

  return {
    command,
    shellType: "bash",
    description: "Install using GitHub CLI (requires gh to be installed)",
    warnings: ["Requires GitHub CLI (gh) to be installed and authenticated"],
  };
}

export function generateInstallCommand(
  options: CommandGenerationOptions
): GeneratedCommand {
  const { os, hasBundle, sourceUrl } = options;

  if (hasBundle && sourceUrl) {
    const command = generateGitHubCloneCommand(options);
    return {
      command,
      shellType: os === "windows" ? "powershell" : "bash",
      description:
        "Install skill bundle with all assets via git sparse checkout",
      warnings: [
        "This skill has additional files (scripts, references, or assets). The full bundle will be cloned.",
      ],
    };
  }

  if (os === "windows") {
    return {
      command: generateWindowsCommand(options),
      shellType: "powershell",
      description: "Install skill by creating directory and writing SKILL.md",
    };
  }

  return {
    command: generateUnixCommand(options),
    shellType: "bash",
    description: "Install skill by creating directory and writing SKILL.md",
  };
}

export function generateOneLinerCommand(
  options: CommandGenerationOptions
): string {
  const { tool, scope, os, skillName, skillContent } = options;
  const installPath = getInstallPath(tool, scope, os, skillName);
  const base64Content = Buffer.from(skillContent, "utf-8").toString("base64");

  if (usesFlatFileFormat(tool)) {
    const parentDir = extractParentDirectory(installPath, os);
    if (os === "windows") {
      return `New-Item -ItemType Directory -Force -Path "${parentDir}" | Out-Null; [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${base64Content}")) | Set-Content -Path "${installPath}" -Encoding UTF8`;
    }
    return `mkdir -p "${parentDir}" && echo "${base64Content}" | base64 -d > "${installPath}"`;
  }

  if (os === "windows") {
    return `New-Item -ItemType Directory -Force -Path "${installPath}" | Out-Null; [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${base64Content}")) | Set-Content -Path "${installPath}\\SKILL.md" -Encoding UTF8`;
  }

  return `mkdir -p "${installPath}" && echo "${base64Content}" | base64 -d > "${installPath}/SKILL.md"`;
}

export function generateCurlCommand(
  options: CommandGenerationOptions
): GeneratedCommand | null {
  const { sourceUrl, tool, scope, os, skillName } = options;

  if (!sourceUrl) {
    return null;
  }

  const rawUrl = sourceUrl
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");

  const installPath = getInstallPath(tool, scope, os, skillName);
  const isFlatFile = usesFlatFileFormat(tool);

  if (os === "windows") {
    const parentDir = isFlatFile
      ? extractParentDirectory(installPath, "windows")
      : installPath;
    const targetPath = isFlatFile ? installPath : `${installPath}\\SKILL.md`;
    const command = [
      `New-Item -ItemType Directory -Force -Path "${parentDir}" | Out-Null`,
      `Invoke-WebRequest -Uri "${rawUrl}" -OutFile "${targetPath}"`,
      `Write-Host "✓ Skill '${skillName}' installed to ${installPath}" -ForegroundColor Green`,
    ].join("\n");

    return {
      command,
      shellType: "powershell",
      description: isFlatFile
        ? "Download skill file directly from GitHub"
        : "Download SKILL.md directly from GitHub",
    };
  }

  const parentDir = isFlatFile
    ? extractParentDirectory(installPath, os)
    : installPath;
  const targetPath = isFlatFile ? installPath : `${installPath}/SKILL.md`;
  const command = [
    `mkdir -p "${parentDir}"`,
    `curl -fsSL "${rawUrl}" -o "${targetPath}"`,
    `echo "✓ Skill '${skillName}' installed to ${installPath}"`,
  ].join("\n");

  return {
    command,
    shellType: "bash",
    description: isFlatFile
      ? "Download skill file directly from GitHub using curl"
      : "Download SKILL.md directly from GitHub using curl",
  };
}
