#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeKind {
    Added,
    Changed,
    Unchanged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Stat {
    pub size: i64,
    pub mtime_ns: i64,
}

/// A file is rehashed only when (size, mtime_ns) moved — a full rescan then costs a stat per file.
pub fn classify_change(previous: Option<Stat>, current: Stat) -> ChangeKind {
    match previous {
        None => ChangeKind::Added,
        Some(previous) if previous == current => ChangeKind::Unchanged,
        Some(_) => ChangeKind::Changed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CURRENT: Stat = Stat {
        size: 120,
        mtime_ns: 1_700_000_000_000_000_000,
    };

    #[test]
    fn an_unknown_path_is_added() {
        assert_eq!(classify_change(None, CURRENT), ChangeKind::Added);
    }

    #[test]
    fn identical_stats_are_unchanged() {
        assert_eq!(
            classify_change(Some(CURRENT), CURRENT),
            ChangeKind::Unchanged
        );
    }

    #[test]
    fn a_new_mtime_marks_the_file_changed() {
        let previous = Stat {
            mtime_ns: CURRENT.mtime_ns - 1,
            ..CURRENT
        };

        assert_eq!(
            classify_change(Some(previous), CURRENT),
            ChangeKind::Changed
        );
    }

    #[test]
    fn a_new_size_marks_the_file_changed() {
        let previous = Stat {
            size: CURRENT.size + 1,
            ..CURRENT
        };

        assert_eq!(
            classify_change(Some(previous), CURRENT),
            ChangeKind::Changed
        );
    }
}
