use std::collections::BTreeSet;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::db::roots_repo;
use crate::error::{AppError, AppResult};
use crate::events;
use crate::fsops;
use crate::paths::ensure_within_roots;
use crate::state::AppState;
use crate::watcher;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallEntry {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub written: Vec<String>,
    pub skipped: Vec<String>,
    pub file_ids: Vec<i64>,
}

/// Expands `~` and resolves `.`/`..` without touching the disk — the target of an
/// install does not exist yet, so it cannot be canonicalized before the write.
fn normalize(raw: &str) -> AppResult<PathBuf> {
    let expanded = match raw.strip_prefix("~/") {
        Some(rest) => dirs::home_dir()
            .ok_or_else(|| AppError::InvalidPath("no home directory".to_string()))?
            .join(rest),
        None => PathBuf::from(raw),
    };

    if !expanded.is_absolute() {
        return Err(AppError::InvalidPath(format!("{raw} is not absolute")));
    }

    let mut normalized = PathBuf::new();
    for component in expanded.components() {
        match component {
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err(AppError::InvalidPath(format!("{raw} escapes the root")));
                }
            }
            Component::CurDir => {}
            other => normalized.push(other),
        }
    }
    Ok(normalized)
}

#[tauri::command]
pub fn install_files(
    app: AppHandle,
    state: State<'_, AppState>,
    entries: Vec<InstallEntry>,
    overwrite: bool,
) -> AppResult<InstallResult> {
    let roots = state.db.with_conn(roots_repo::list_enabled)?;
    let mut written = Vec::new();
    let mut skipped = Vec::new();
    let mut touched: BTreeSet<PathBuf> = BTreeSet::new();

    for entry in &entries {
        let path = normalize(&entry.path)?;
        ensure_within_roots(&path, &roots)?;

        if path.exists() && !overwrite {
            skipped.push(path.to_string_lossy().into_owned());
            continue;
        }

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        fsops::atomic_write(&path, &entry.content)?;

        // symlinked ancestors could have redirected the write out of the roots
        if let Err(error) = verify_landed_inside(&path, &roots) {
            let _ = std::fs::remove_file(&path);
            return Err(error);
        }

        written.push(path.to_string_lossy().into_owned());
        touched.insert(path);
    }

    let file_ids = watcher::reindex(&state.db, &roots, &touched)?;
    events::emit_index_updated(&app, file_ids.clone());

    Ok(InstallResult {
        written,
        skipped,
        file_ids,
    })
}

fn verify_landed_inside(path: &Path, roots: &[roots_repo::Root]) -> AppResult<()> {
    let resolved = path
        .canonicalize()
        .map_err(|error| AppError::InvalidPath(format!("{}: {error}", path.display())))?;
    ensure_within_roots(&resolved, roots)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expands_a_home_relative_path() {
        let home = dirs::home_dir().unwrap();

        assert_eq!(
            normalize("~/.claude/skills/demo/SKILL.md").unwrap(),
            home.join(".claude/skills/demo/SKILL.md")
        );
    }

    #[test]
    fn resolves_dot_segments() {
        assert_eq!(
            normalize("/repo/./a/../b/CLAUDE.md").unwrap(),
            PathBuf::from("/repo/b/CLAUDE.md")
        );
    }

    #[test]
    fn rejects_a_relative_path() {
        assert_eq!(
            normalize("skills/demo/SKILL.md").unwrap_err().code(),
            "invalid_path"
        );
    }

    #[test]
    fn rejects_a_traversal_above_the_filesystem_root() {
        assert_eq!(
            normalize("/../etc/passwd").unwrap_err().code(),
            "invalid_path"
        );
    }

    #[test]
    fn a_traversal_out_of_a_root_is_caught_by_containment() {
        let roots = vec![roots_repo::Root {
            id: 1,
            path: "/Users/me/.claude".to_string(),
            enabled: true,
            added_at: 0,
        }];
        let escaped = normalize("/Users/me/.claude/../.ssh/authorized_keys").unwrap();

        assert_eq!(
            ensure_within_roots(&escaped, &roots).unwrap_err().code(),
            "outside_roots"
        );
    }
}
