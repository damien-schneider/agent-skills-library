use serde::Serialize;
use similar::{ChangeTag, TextDiff};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffOp {
    Equal,
    Added,
    Removed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub op: DiffOp,
    pub text: String,
    pub left_number: Option<usize>,
    pub right_number: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffResult {
    pub identical: bool,
    pub added: usize,
    pub removed: usize,
    pub lines: Vec<DiffLine>,
}

pub fn diff_text(before: &str, after: &str) -> DiffResult {
    let diff = TextDiff::from_lines(before, after);
    let mut lines = Vec::new();
    let mut added = 0;
    let mut removed = 0;

    for change in diff.iter_all_changes() {
        let op = match change.tag() {
            ChangeTag::Equal => DiffOp::Equal,
            ChangeTag::Insert => {
                added += 1;
                DiffOp::Added
            }
            ChangeTag::Delete => {
                removed += 1;
                DiffOp::Removed
            }
        };
        lines.push(DiffLine {
            op,
            text: change.value().trim_end_matches('\n').to_string(),
            left_number: change.old_index().map(|index| index + 1),
            right_number: change.new_index().map(|index| index + 1),
        });
    }

    DiffResult {
        identical: added == 0 && removed == 0,
        added,
        removed,
        lines,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_text_produces_no_changes() {
        let result = diff_text("a\nb\n", "a\nb\n");

        assert!(result.identical);
        assert_eq!((result.added, result.removed), (0, 0));
        assert!(result.lines.iter().all(|line| line.op == DiffOp::Equal));
    }

    #[test]
    fn counts_insertions_and_deletions() {
        let result = diff_text("a\nb\nc\n", "a\nx\ny\nc\n");

        assert!(!result.identical);
        assert_eq!((result.added, result.removed), (2, 1));
    }

    #[test]
    fn numbers_lines_on_each_side() {
        let result = diff_text("a\nb\n", "a\nB\n");

        let removed = result
            .lines
            .iter()
            .find(|line| line.op == DiffOp::Removed)
            .unwrap();
        let inserted = result
            .lines
            .iter()
            .find(|line| line.op == DiffOp::Added)
            .unwrap();

        assert_eq!((removed.left_number, removed.right_number), (Some(2), None));
        assert_eq!(
            (inserted.left_number, inserted.right_number),
            (None, Some(2))
        );
    }

    #[test]
    fn handles_an_empty_side() {
        let result = diff_text("", "a\n");

        assert_eq!((result.added, result.removed), (1, 0));
    }

    #[test]
    fn strips_the_trailing_newline_from_line_text() {
        let result = diff_text("a\n", "b\n");

        assert!(result.lines.iter().all(|line| !line.text.contains('\n')));
    }
}
