use yaml_rust2::YamlLoader;

use super::targets::FileKind;

const FENCE: &str = "---";
const MAX_DESCRIPTION_CHARS: usize = 1024;

/// The YAML between the opening fence and the next one; `None` without a closed block.
fn block(text: &str) -> Option<&str> {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let (opening, body) = text.split_once('\n')?;
    if opening.trim_end() != FENCE {
        return None;
    }

    let mut end = 0;
    for line in body.split_inclusive('\n') {
        if line.trim_end() == FENCE {
            return Some(&body[..end]);
        }
        end += line.len();
    }
    None
}

/// A folded or literal block scalar keeps its line breaks; the index wants one line.
fn collapse(value: &str) -> Option<String> {
    let mut collapsed = String::with_capacity(value.len().min(MAX_DESCRIPTION_CHARS));
    for word in value.split_whitespace() {
        if !collapsed.is_empty() {
            collapsed.push(' ');
        }
        collapsed.push_str(word);
    }

    if let Some((cut, _)) = collapsed.char_indices().nth(MAX_DESCRIPTION_CHARS) {
        collapsed.truncate(cut);
        collapsed.truncate(collapsed.trim_end().len());
    }
    (!collapsed.is_empty()).then_some(collapsed)
}

/// The frontmatter `description`. Malformed YAML is an everyday sight in hand-written
/// skills, so anything unreadable is simply no description, never an error.
pub fn description(text: &str) -> Option<String> {
    let documents = YamlLoader::load_from_str(block(text)?).ok()?;
    collapse(documents.first()?["description"].as_str()?)
}

/// Only the kinds whose frontmatter an agent reads to decide when to load the file.
pub fn description_for(kind: FileKind, text: &str) -> Option<String> {
    match kind {
        FileKind::Skill | FileKind::ClaudeAgent | FileKind::CursorRule => description(text),
        FileKind::AgentsMd | FileKind::ClaudeMd | FileKind::GeminiMd => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_plain_description() {
        let text = "---\nname: demo\ndescription: Use when writing tests\n---\n# Demo\n";

        assert_eq!(description(text).as_deref(), Some("Use when writing tests"));
    }

    #[test]
    fn reads_quoted_strings() {
        let double = "---\ndescription: \"Use when: the user says \\\"ship it\\\"\"\n---\n";
        let single = "---\ndescription: 'It''s for reviews: always'\n---\n";

        assert_eq!(
            description(double).as_deref(),
            Some("Use when: the user says \"ship it\"")
        );
        assert_eq!(
            description(single).as_deref(),
            Some("It's for reviews: always")
        );
    }

    #[test]
    fn collapses_a_folded_block_scalar() {
        let text = "---\nname: demo\ndescription: >\n  Use when the user\n  asks for a review.\n\n  Not for tests.\nmodel: opus\n---\nbody";

        assert_eq!(
            description(text).as_deref(),
            Some("Use when the user asks for a review. Not for tests.")
        );
    }

    #[test]
    fn collapses_a_literal_block_scalar() {
        let text = "---\ndescription: |-\n  First line\n    indented second\n  third\n---\n";

        assert_eq!(
            description(text).as_deref(),
            Some("First line indented second third")
        );
    }

    #[test]
    fn collapses_a_multi_line_plain_scalar() {
        let text = "---\ndescription: Use when the user\n  asks for\t a review\n---\n";

        assert_eq!(
            description(text).as_deref(),
            Some("Use when the user asks for a review")
        );
    }

    #[test]
    fn reads_past_a_byte_order_mark_and_windows_line_endings() {
        let text = "\u{feff}---\r\ndescription: Windows file\r\n---\r\nbody\r\n";

        assert_eq!(description(text).as_deref(), Some("Windows file"));
    }

    #[test]
    fn malformed_frontmatter_is_no_description() {
        for text in [
            "---\ndescription: Use when: the colon breaks it\n---\n",
            "---\ndescription: \"unterminated\n---\n",
            "---\n\tdescription: tab indented\n: nope\n---\n",
            "---\n- a\n- list\n---\n",
            "---\njust a sentence\n---\n",
            "---\n---\n",
        ] {
            assert_eq!(description(text), None, "{text:?}");
        }
    }

    #[test]
    fn a_missing_or_unclosed_block_is_no_description() {
        assert_eq!(description(""), None);
        assert_eq!(description("# Title\ndescription: not frontmatter\n"), None);
        assert_eq!(description("---\ndescription: never closed\n"), None);
        assert_eq!(description("----\ndescription: wrong fence\n---\n"), None);
        assert_eq!(
            description("\n---\ndescription: not on the first line\n---\n"),
            None
        );
    }

    #[test]
    fn a_non_string_or_blank_description_is_none() {
        assert_eq!(description("---\ndescription: 42\n---\n"), None);
        assert_eq!(description("---\ndescription:\n---\n"), None);
        assert_eq!(description("---\ndescription: \"   \"\n---\n"), None);
        assert_eq!(description("---\ndescription: [a, b]\n---\n"), None);
        assert_eq!(description("---\nname: demo\n---\n"), None);
    }

    #[test]
    fn stops_at_the_first_closing_fence() {
        let text = "---\ndescription: real\n---\nbody\n---\ndescription: decoy\n---\n";

        assert_eq!(description(text).as_deref(), Some("real"));
    }

    #[test]
    fn caps_the_length_in_characters_not_bytes() {
        let long = "é".repeat(MAX_DESCRIPTION_CHARS + 50);
        let text = format!("---\ndescription: {long}\n---\n");

        let read = description(&text).unwrap();

        assert_eq!(read.chars().count(), MAX_DESCRIPTION_CHARS);
    }

    #[test]
    fn a_cut_never_leaves_a_trailing_space() {
        let words = format!("{} tail", "a".repeat(MAX_DESCRIPTION_CHARS - 1));
        let text = format!("---\ndescription: {words}\n---\n");

        let read = description(&text).unwrap();

        assert_eq!(read, "a".repeat(MAX_DESCRIPTION_CHARS - 1));
    }

    #[test]
    fn only_skills_agents_and_rules_carry_a_description() {
        let text = "---\ndescription: shared\n---\n";

        for kind in [FileKind::Skill, FileKind::ClaudeAgent, FileKind::CursorRule] {
            assert_eq!(description_for(kind, text).as_deref(), Some("shared"));
        }
        for kind in [FileKind::AgentsMd, FileKind::ClaudeMd, FileKind::GeminiMd] {
            assert_eq!(description_for(kind, text), None);
        }
    }
}
