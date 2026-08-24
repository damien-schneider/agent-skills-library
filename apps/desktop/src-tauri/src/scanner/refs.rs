use std::collections::BTreeSet;
use std::io;
use std::path::Path;

use super::hash::{hash_bytes, hash_file};
use super::targets::FileKind;

/// Above this a file is hashed but not read for references: index targets are prose.
const MAX_READ_BYTES: u64 = 1024 * 1024;
const MIN_NAME_LEN: usize = 3;
const MAX_NAME_LEN: usize = 64;

pub struct Indexed {
    pub hash: String,
    pub refs: BTreeSet<String>,
}

/// One read serves both the hash and the reference extraction.
pub fn index_file(path: &Path, size: u64) -> io::Result<Indexed> {
    if size > MAX_READ_BYTES {
        return Ok(Indexed {
            hash: hash_file(path, size)?,
            refs: BTreeSet::new(),
        });
    }
    let bytes = std::fs::read(path)?;
    let refs = match std::str::from_utf8(&bytes) {
        Ok(text) => extract(text),
        Err(_) => BTreeSet::new(),
    };
    Ok(Indexed {
        hash: hash_bytes(&bytes),
        refs,
    })
}

/// The name this file answers to when another file mentions it.
pub fn name_for(path: &Path, kind: FileKind) -> Option<String> {
    let raw = match kind {
        FileKind::ClaudeSkill => path.parent()?.file_name()?,
        FileKind::ClaudeAgent | FileKind::CursorRule => path.file_stem()?,
        FileKind::AgentsMd | FileKind::ClaudeMd | FileKind::GeminiMd => return None,
    };
    let name = raw.to_string_lossy().to_lowercase();
    is_name(&name).then_some(name)
}

fn is_name(token: &str) -> bool {
    if !(MIN_NAME_LEN..=MAX_NAME_LEN).contains(&token.len()) {
        return false;
    }
    token.split('-').all(|segment| {
        !segment.is_empty()
            && segment
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    })
}

/// Non-ASCII bytes join the token so an accented word is rejected whole rather
/// than truncated into a plausible-looking name.
fn is_token_byte(byte: u8) -> bool {
    !byte.is_ascii() || byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'
}

/// A bare word only counts when it is kebab-cased: prose is full of single words
/// that happen to match a skill name, but nobody writes `react-doctor` by accident.
fn is_reference(token: &str, before: Option<u8>, after: Option<u8>) -> bool {
    let marked =
        matches!(before, Some(b'`' | b'/' | b'[' | b'@')) || matches!(after, Some(b'`' | b'/'));
    marked || token.contains('-')
}

/// Names mentioned by this text, resolved against the index later — a token that
/// matches no indexed file is simply dropped there.
pub fn extract(text: &str) -> BTreeSet<String> {
    let bytes = text.as_bytes();
    let mut names = BTreeSet::new();
    let mut cursor = 0;

    while cursor < bytes.len() {
        if !is_token_byte(bytes[cursor]) {
            cursor += 1;
            continue;
        }
        let start = cursor;
        while cursor < bytes.len() && is_token_byte(bytes[cursor]) {
            cursor += 1;
        }

        let token = text[start..cursor].to_lowercase();
        let before = start.checked_sub(1).map(|index| bytes[index]);
        let after = bytes.get(cursor).copied();
        if is_name(&token) && is_reference(&token, before, after) {
            names.insert(token);
        }
    }

    names
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn extracted(text: &str) -> Vec<String> {
        extract(text).into_iter().collect()
    }

    #[test]
    fn reads_the_reference_syntaxes_used_across_the_corpus() {
        let text = "Pairs with `ux-exploration` — see /clean-github-caches and \
                    ux-rules/references/ux-laws-toolkit.md, plus [[find-skills]].";

        assert_eq!(
            extracted(text),
            [
                "clean-github-caches",
                "find-skills",
                "references",
                "ux-exploration",
                "ux-laws-toolkit",
                "ux-rules"
            ]
        );
    }

    #[test]
    fn keeps_a_bare_kebab_name_but_drops_bare_prose() {
        let text = "check react-best-practices skill + react-doctor when touching React code";

        assert_eq!(extracted(text), ["react-best-practices", "react-doctor"]);
    }

    #[test]
    fn keeps_a_single_word_name_only_when_it_is_marked_up() {
        assert_eq!(extracted("run the `upgrade` skill"), ["upgrade"]);
        assert_eq!(extracted("run /upgrade now"), ["upgrade"]);
        assert!(extracted("time to upgrade the deps").is_empty());
    }

    #[test]
    fn ignores_tokens_that_cannot_be_skill_names() {
        assert!(extracted("/a `x_y` `12` /café /-nope-").is_empty());
    }

    #[test]
    fn names_a_skill_after_its_directory_and_an_agent_after_its_file() {
        let skill = PathBuf::from("/repo/.claude/skills/design-explore/SKILL.md");
        let agent = PathBuf::from("/repo/.claude/agents/TDD-Test-Author.md");
        let claude_md = PathBuf::from("/repo/CLAUDE.md");

        assert_eq!(
            name_for(&skill, FileKind::ClaudeSkill).as_deref(),
            Some("design-explore")
        );
        assert_eq!(
            name_for(&agent, FileKind::ClaudeAgent).as_deref(),
            Some("tdd-test-author")
        );
        assert_eq!(name_for(&claude_md, FileKind::ClaudeMd), None);
    }

    #[test]
    fn hashes_and_extracts_in_a_single_read() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("CLAUDE.md");
        std::fs::write(&path, "use `agent-browser`").unwrap();

        let indexed = index_file(&path, 19).unwrap();

        assert_eq!(indexed.hash, hash_bytes(b"use `agent-browser`"));
        assert_eq!(
            indexed.refs.into_iter().collect::<Vec<_>>(),
            ["agent-browser"]
        );
    }
}
