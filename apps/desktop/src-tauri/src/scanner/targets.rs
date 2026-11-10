use std::path::Path;

use serde::{Deserialize, Serialize};

/// Mirror of packages/skills-core/src/scan-targets.ts — both sides are frozen by a test.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FileKind {
    AgentsMd,
    ClaudeMd,
    GeminiMd,
    CursorRule,
    Skill,
    ClaudeAgent,
}

impl FileKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AgentsMd => "agents-md",
            Self::ClaudeMd => "claude-md",
            Self::GeminiMd => "gemini-md",
            Self::CursorRule => "cursor-rule",
            Self::Skill => "skill",
            Self::ClaudeAgent => "claude-agent",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "agents-md" => Some(Self::AgentsMd),
            "claude-md" => Some(Self::ClaudeMd),
            "gemini-md" => Some(Self::GeminiMd),
            "cursor-rule" => Some(Self::CursorRule),
            "skill" => Some(Self::Skill),
            "claude-agent" => Some(Self::ClaudeAgent),
            _ => None,
        }
    }
}

pub struct ScanTarget {
    pub kind: FileKind,
    pub file_names: &'static [&'static str],
    pub extension: Option<&'static str>,
    pub ancestor_dir: &'static [&'static str],
}

pub const SCAN_TARGETS: &[ScanTarget] = &[
    // no ancestor: skills live in `.agents/skills`, `~/.codex/skills`, a repo's `skills/`, …
    ScanTarget {
        kind: FileKind::Skill,
        file_names: &["SKILL.md"],
        extension: None,
        ancestor_dir: &[],
    },
    ScanTarget {
        kind: FileKind::ClaudeAgent,
        file_names: &[],
        extension: Some(".md"),
        ancestor_dir: &[".claude", "agents"],
    },
    ScanTarget {
        kind: FileKind::CursorRule,
        file_names: &[],
        extension: Some(".mdc"),
        ancestor_dir: &[".cursor", "rules"],
    },
    ScanTarget {
        kind: FileKind::AgentsMd,
        file_names: &["AGENTS.md"],
        extension: None,
        ancestor_dir: &[],
    },
    ScanTarget {
        kind: FileKind::ClaudeMd,
        file_names: &["CLAUDE.md", "CLAUDE.local.md"],
        extension: None,
        ancestor_dir: &[],
    },
    ScanTarget {
        kind: FileKind::GeminiMd,
        file_names: &["GEMINI.md"],
        extension: None,
        ancestor_dir: &[],
    },
];

/// Not gitignore-driven: repos routinely ignore `.claude/`, which still has to be indexed.
pub const SKIP_DIRS: &[&str] = &[
    ".git",
    ".hg",
    ".svn",
    ".jj",
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    ".next",
    ".turbo",
    ".cache",
    // Scratch copies, e.g. Codex's plugin marketplace checkout in `~/.codex/.tmp`.
    ".tmp",
    ".venv",
    "venv",
    "__pycache__",
    "vendor",
    ".gradle",
    "Pods",
    ".terraform",
    "coverage",
];

/// Agent homes whose `plugins` directory holds read-only marketplace copies the user
/// does not maintain; indexing them would bury the library under vendor skills.
pub const VENDOR_PLUGIN_PARENTS: &[&str] = &[".claude", ".codex", ".cursor", ".gemini", ".agents"];

const VENDOR_PLUGIN_DIR: &str = "plugins";

pub fn is_skipped_dir(name: &str) -> bool {
    SKIP_DIRS.contains(&name)
}

fn dir_name(dir: &Path) -> Option<&str> {
    dir.file_name().and_then(|name| name.to_str())
}

pub fn is_vendor_plugin_dir(dir: &Path) -> bool {
    dir_name(dir) == Some(VENDOR_PLUGIN_DIR)
        && dir
            .parent()
            .and_then(dir_name)
            .is_some_and(|parent| VENDOR_PLUGIN_PARENTS.contains(&parent))
}

/// True when the walker never descends below `root` far enough to reach `path`,
/// so paths arriving from anywhere else (watcher events, installs) get the same answer.
pub fn is_skipped_below(root: &Path, path: &Path) -> bool {
    path.ancestors()
        .skip(1)
        .take_while(|dir| *dir != root && dir.starts_with(root))
        .any(|dir| is_vendor_plugin_dir(dir) || dir_name(dir).is_some_and(is_skipped_dir))
}

fn has_ancestor_dir(parent_segments: &[&str], needle: &[&str]) -> bool {
    if needle.is_empty() || needle.len() > parent_segments.len() {
        return needle.is_empty();
    }
    parent_segments.windows(needle.len()).any(|w| w == needle)
}

fn matches(target: &ScanTarget, file_name: &str, parent_segments: &[&str]) -> bool {
    if !has_ancestor_dir(parent_segments, target.ancestor_dir) {
        return false;
    }
    if !target.file_names.is_empty() {
        return target.file_names.contains(&file_name);
    }
    match target.extension {
        Some(extension) => file_name.ends_with(extension),
        None => false,
    }
}

pub fn classify(path: &Path) -> Option<FileKind> {
    let file_name = path.file_name()?.to_str()?;
    let parent_segments: Vec<&str> = path
        .parent()
        .map(|parent| {
            parent
                .components()
                .filter_map(|component| component.as_os_str().to_str())
                .filter(|segment| !segment.is_empty() && *segment != "/")
                .collect()
        })
        .unwrap_or_default();

    SCAN_TARGETS
        .iter()
        .find(|target| matches(target, file_name, &parent_segments))
        .map(|target| target.kind)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn kind_of(path: &str) -> Option<FileKind> {
        classify(&PathBuf::from(path))
    }

    #[test]
    fn classifies_every_supported_target() {
        assert_eq!(kind_of("/repo/AGENTS.md"), Some(FileKind::AgentsMd));
        assert_eq!(
            kind_of("/repo/packages/api/AGENTS.md"),
            Some(FileKind::AgentsMd)
        );
        assert_eq!(kind_of("/repo/CLAUDE.md"), Some(FileKind::ClaudeMd));
        assert_eq!(kind_of("/repo/CLAUDE.local.md"), Some(FileKind::ClaudeMd));
        assert_eq!(kind_of("/repo/GEMINI.md"), Some(FileKind::GeminiMd));
        assert_eq!(
            kind_of("/repo/.cursor/rules/style.mdc"),
            Some(FileKind::CursorRule)
        );
        assert_eq!(
            kind_of("/repo/.claude/skills/my-skill/SKILL.md"),
            Some(FileKind::Skill)
        );
        assert_eq!(
            kind_of("/Users/me/.claude/skills/deep/nested/SKILL.md"),
            Some(FileKind::Skill)
        );
        assert_eq!(
            kind_of("/repo/.claude/agents/reviewer.md"),
            Some(FileKind::ClaudeAgent)
        );
    }

    #[test]
    fn a_skill_is_any_skill_md_whatever_its_ancestors() {
        for path in [
            "/repo/.agents/skills/my-skill/SKILL.md",
            "/Users/me/.codex/skills/my-skill/SKILL.md",
            "/repo/skills/my-skill/SKILL.md",
            "/repo/my-skill/SKILL.md",
            "/repo/SKILL.md",
            "/repo/.claude/agents/SKILL.md",
        ] {
            assert_eq!(kind_of(path), Some(FileKind::Skill), "{path}");
        }
    }

    #[test]
    fn rejects_non_targets() {
        assert_eq!(kind_of("/repo/README.md"), None);
        assert_eq!(kind_of("/repo/agents.md"), None);
        assert_eq!(kind_of("/repo/skills/my-skill/skill.md"), None);
        assert_eq!(kind_of("/repo/skills/my-skill/SKILL.mdx"), None);
        assert_eq!(kind_of("/repo/.cursor/rules/style.md"), None);
        assert_eq!(kind_of("/repo/rules/style.mdc"), None);
        assert_eq!(kind_of("/repo/.claude/settings.json"), None);
        assert_eq!(kind_of("/repo/.claude/agents/config.json"), None);
    }

    #[test]
    fn requires_consecutive_ancestor_segments() {
        assert_eq!(kind_of("/repo/.claude/other/agents/reviewer.md"), None);
        assert_eq!(kind_of("/repo/.cursor/other/rules/style.mdc"), None);
    }

    type FrozenTarget<'a> = (&'a str, &'a [&'a str], Option<&'a str>, &'a [&'a str]);

    #[test]
    fn freezes_the_target_table() {
        let frozen: Vec<FrozenTarget> = SCAN_TARGETS
            .iter()
            .map(|t| (t.kind.as_str(), t.file_names, t.extension, t.ancestor_dir))
            .collect();

        assert_eq!(
            frozen,
            vec![
                ("skill", &["SKILL.md"][..], None, &[][..]),
                (
                    "claude-agent",
                    &[][..],
                    Some(".md"),
                    &[".claude", "agents"][..]
                ),
                (
                    "cursor-rule",
                    &[][..],
                    Some(".mdc"),
                    &[".cursor", "rules"][..]
                ),
                ("agents-md", &["AGENTS.md"][..], None, &[][..]),
                (
                    "claude-md",
                    &["CLAUDE.md", "CLAUDE.local.md"][..],
                    None,
                    &[][..]
                ),
                ("gemini-md", &["GEMINI.md"][..], None, &[][..]),
            ]
        );
    }

    #[test]
    fn never_skips_agent_config_directories() {
        assert!(is_skipped_dir("node_modules"));
        assert!(is_skipped_dir(".tmp"));
        assert!(is_skipped_dir(".git"));
        assert!(!is_skipped_dir("src"));
        assert!(!is_skipped_dir(".claude"));
        assert!(!is_skipped_dir(".cursor"));
        assert!(!is_skipped_dir("plugins"));
    }

    #[test]
    fn freezes_the_vendor_plugin_parents() {
        assert_eq!(
            VENDOR_PLUGIN_PARENTS,
            [".claude", ".codex", ".cursor", ".gemini", ".agents"]
        );
    }

    #[test]
    fn a_plugins_directory_is_vendor_only_inside_an_agent_home() {
        for home in VENDOR_PLUGIN_PARENTS {
            let dir = PathBuf::from(format!("/Users/me/{home}/plugins"));
            assert!(is_vendor_plugin_dir(&dir), "{home}");
        }
        assert!(!is_vendor_plugin_dir(Path::new("/repo/plugins")));
        assert!(!is_vendor_plugin_dir(Path::new("/repo/src/plugins")));
        assert!(!is_vendor_plugin_dir(Path::new("/Users/me/.claude/skills")));
        assert!(!is_vendor_plugin_dir(Path::new(
            "/Users/me/.claude/plugins/cache"
        )));
        assert!(!is_vendor_plugin_dir(Path::new("plugins")));
    }

    #[test]
    fn skips_whatever_the_walker_would_not_reach_below_a_root() {
        let root = Path::new("/Users/me");
        let skipped = |path: &str| is_skipped_below(root, Path::new(path));

        assert!(skipped(
            "/Users/me/.claude/plugins/marketplaces/x/skills/c/SKILL.md"
        ));
        assert!(skipped("/Users/me/.codex/plugins/cache/x/SKILL.md"));
        assert!(skipped("/Users/me/repo/node_modules/pkg/CLAUDE.md"));
        assert!(!skipped("/Users/me/.claude/skills/c/SKILL.md"));
        assert!(!skipped("/Users/me/repo/plugins/c/SKILL.md"));
    }

    #[test]
    fn a_root_is_walked_even_when_its_own_path_looks_skipped() {
        let vendor = Path::new("/Users/me/.claude/plugins");
        let build = Path::new("/Users/me/build");

        assert!(!is_skipped_below(vendor, &vendor.join("x/SKILL.md")));
        assert!(!is_skipped_below(build, &build.join("repo/CLAUDE.md")));
        assert!(is_skipped_below(build, &build.join("repo/dist/CLAUDE.md")));
    }

    #[test]
    fn the_agent_home_may_be_the_root_itself() {
        let root = Path::new("/Users/me/.claude");

        assert!(is_skipped_below(
            root,
            Path::new("/Users/me/.claude/plugins/cache/x/SKILL.md")
        ));
    }

    #[test]
    fn kind_round_trips_through_its_string_form() {
        for target in SCAN_TARGETS {
            assert_eq!(FileKind::from_str(target.kind.as_str()), Some(target.kind));
        }
    }

    #[test]
    fn kind_serializes_as_the_typescript_literal() {
        let json = serde_json::to_string(&FileKind::Skill).unwrap();

        assert_eq!(json, "\"skill\"");
    }
}
