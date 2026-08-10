use std::path::{Path, PathBuf};

use crate::db::roots_repo::Root;
use crate::error::{AppError, AppResult};

/// Custom commands bypass the Tauri fs scope, so every incoming path is resolved
/// here and checked against the enabled roots before anything touches the disk.
pub fn canonicalize(path: &Path) -> AppResult<PathBuf> {
    path.canonicalize()
        .map_err(|err| AppError::InvalidPath(format!("{}: {err}", path.display())))
}

pub fn ensure_within_roots(path: &Path, roots: &[Root]) -> AppResult<()> {
    let allowed = roots
        .iter()
        .any(|root| path.starts_with(Path::new(&root.path)));

    if allowed {
        Ok(())
    } else {
        Err(AppError::OutsideRoots(path.display().to_string()))
    }
}

pub fn conflicts_with_existing_root(candidate: &Path, roots: &[Root]) -> Option<String> {
    roots.iter().find_map(|root| {
        let existing = Path::new(&root.path);
        if candidate.starts_with(existing) || existing.starts_with(candidate) {
            Some(root.path.clone())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root(path: &str) -> Root {
        Root {
            id: 1,
            path: path.to_string(),
            enabled: true,
            added_at: 0,
        }
    }

    #[test]
    fn accepts_a_path_inside_a_root() {
        let roots = vec![root("/Users/me/GitHub")];

        assert!(ensure_within_roots(Path::new("/Users/me/GitHub/app/CLAUDE.md"), &roots).is_ok());
    }

    #[test]
    fn rejects_a_path_outside_every_root() {
        let roots = vec![root("/Users/me/GitHub")];

        let err = ensure_within_roots(Path::new("/etc/passwd"), &roots).unwrap_err();

        assert_eq!(err.code(), "outside_roots");
    }

    #[test]
    fn rejects_a_sibling_directory_sharing_a_prefix() {
        let roots = vec![root("/Users/me/GitHub")];

        assert!(ensure_within_roots(Path::new("/Users/me/GitHub-old/CLAUDE.md"), &roots).is_err());
    }

    #[test]
    fn rejects_every_path_when_no_root_is_enabled() {
        assert!(ensure_within_roots(Path::new("/Users/me/GitHub/CLAUDE.md"), &[]).is_err());
    }

    #[test]
    fn detects_a_root_nested_in_an_existing_one() {
        let roots = vec![root("/Users/me/GitHub")];

        assert_eq!(
            conflicts_with_existing_root(Path::new("/Users/me/GitHub/app"), &roots),
            Some("/Users/me/GitHub".to_string())
        );
    }

    #[test]
    fn detects_a_root_that_would_swallow_an_existing_one() {
        let roots = vec![root("/Users/me/GitHub")];

        assert_eq!(
            conflicts_with_existing_root(Path::new("/Users/me"), &roots),
            Some("/Users/me/GitHub".to_string())
        );
    }

    #[test]
    fn allows_an_unrelated_root() {
        let roots = vec![root("/Users/me/GitHub")];

        assert_eq!(
            conflicts_with_existing_root(Path::new("/Users/me/.claude"), &roots),
            None
        );
    }
}
