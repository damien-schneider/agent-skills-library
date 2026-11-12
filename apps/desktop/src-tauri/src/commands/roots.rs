use std::path::{Path, PathBuf};

use tauri::{AppHandle, State};

use crate::db::roots_repo::{self, Root};
use crate::db::{now_ms, set_meta, Db, META_DEFAULT_ROOTS_SEEDED};
use crate::error::{AppError, AppResult};
use crate::paths::{canonicalize, conflicts_with_existing_root};
use crate::state::AppState;

use super::watcher::restart as restart_watcher;

#[tauri::command(async)]
pub fn list_roots(state: State<'_, AppState>) -> AppResult<Vec<Root>> {
    state.db.with_conn(roots_repo::list)
}

#[tauri::command(async)]
pub fn add_root(app: AppHandle, state: State<'_, AppState>, path: String) -> AppResult<Root> {
    let resolved = canonicalize(&PathBuf::from(&path))?;
    if !resolved.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "{} is not a directory",
            resolved.display()
        )));
    }

    let root = state.db.with_conn(|conn| {
        let existing = roots_repo::list(conn)?;
        if let Some(conflict) = conflicts_with_existing_root(&resolved, &existing) {
            return Err(AppError::InvalidPath(format!(
                "{} overlaps the root {conflict}",
                resolved.display()
            )));
        }

        let stored = resolved.to_string_lossy().into_owned();
        let id = roots_repo::insert(conn, &stored, now_ms())?;
        roots_repo::get(conn, id)?
            .ok_or_else(|| AppError::internal("root vanished right after insert"))
    })?;

    restart_watcher(&app, &state)?;
    Ok(root)
}

#[tauri::command(async)]
pub fn set_root_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    id: i64,
    enabled: bool,
) -> AppResult<()> {
    state.db.with_conn(|conn| {
        roots_repo::get(conn, id)?
            .ok_or_else(|| AppError::NotFound(format!("root {id} does not exist")))?;
        roots_repo::set_enabled(conn, id, enabled)
    })?;
    restart_watcher(&app, &state)
}

#[tauri::command(async)]
pub fn remove_root(app: AppHandle, state: State<'_, AppState>, id: i64) -> AppResult<()> {
    state.db.with_conn(|conn| roots_repo::remove(conn, id))?;
    restart_watcher(&app, &state)
}

/// Agent homes first, then the usual places people keep their code.
const DEFAULT_ROOTS: &[&str] = &[
    ".claude",
    ".agents",
    ".codex",
    ".cursor",
    ".gemini",
    ".config/opencode",
    "Documents/GitHub",
    "Developer",
    "Projects",
    "Code",
    "dev",
    "src",
    "repos",
    "workspace",
];

/// Runs once per install: afterwards the user's own list is authoritative, and a
/// folder they removed never comes back.
pub fn seed_default_roots(db: &Db) -> AppResult<()> {
    match dirs::home_dir() {
        Some(home) => seed_roots_under(db, &home),
        None => Ok(()),
    }
}

fn seed_roots_under(db: &Db, home: &Path) -> AppResult<()> {
    db.with_conn(|conn| {
        if crate::db::get_meta(conn, META_DEFAULT_ROOTS_SEEDED)?.is_some() {
            return Ok(());
        }

        for candidate in DEFAULT_ROOTS.iter().map(|relative| home.join(relative)) {
            if !candidate.is_dir() {
                continue;
            }
            // resolving also settles the spelling: on a case-insensitive disk `Code`
            // and `code` come back as the one name stored, so the overlap check sees them
            let Ok(resolved) = candidate.canonicalize() else {
                continue;
            };
            let existing = roots_repo::list(conn)?;
            if conflicts_with_existing_root(&resolved, &existing).is_some() {
                continue;
            }
            roots_repo::insert(conn, &resolved.to_string_lossy(), now_ms())?;
        }

        set_meta(conn, META_DEFAULT_ROOTS_SEEDED, "true")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::get_meta;
    use tempfile::{tempdir, TempDir};

    fn home_with(directories: &[&str]) -> (TempDir, PathBuf) {
        let dir = tempdir().unwrap();
        let home = dir.path().canonicalize().unwrap();
        for directory in directories {
            std::fs::create_dir_all(home.join(directory)).unwrap();
        }
        (dir, home)
    }

    fn root_paths(db: &Db) -> Vec<String> {
        db.with_conn(roots_repo::list)
            .unwrap()
            .into_iter()
            .map(|root| root.path)
            .collect()
    }

    fn under(home: &Path, directories: &[&str]) -> Vec<String> {
        let mut paths: Vec<String> = directories
            .iter()
            .map(|directory| home.join(directory).to_string_lossy().into_owned())
            .collect();
        paths.sort_unstable();
        paths
    }

    #[test]
    fn seeds_the_agent_homes_and_code_folders_that_exist() {
        let db = Db::open_in_memory().unwrap();
        let (_dir, home) = home_with(DEFAULT_ROOTS);

        seed_roots_under(&db, &home).unwrap();

        assert_eq!(root_paths(&db), under(&home, DEFAULT_ROOTS));
    }

    #[test]
    fn freezes_the_default_list() {
        assert_eq!(
            DEFAULT_ROOTS,
            [
                ".claude",
                ".agents",
                ".codex",
                ".cursor",
                ".gemini",
                ".config/opencode",
                "Documents/GitHub",
                "Developer",
                "Projects",
                "Code",
                "dev",
                "src",
                "repos",
                "workspace",
            ]
        );
    }

    #[test]
    fn skips_directories_that_do_not_exist() {
        let db = Db::open_in_memory().unwrap();
        let (_dir, home) = home_with(&[".claude", "Developer"]);
        std::fs::write(home.join(".codex"), "a file, not a folder").unwrap();

        seed_roots_under(&db, &home).unwrap();

        assert_eq!(root_paths(&db), under(&home, &[".claude", "Developer"]));
    }

    #[test]
    fn seeding_runs_once_and_never_re_adds_a_removed_folder() {
        let db = Db::open_in_memory().unwrap();
        let (_dir, home) = home_with(&[".claude", ".agents"]);
        seed_roots_under(&db, &home).unwrap();

        db.with_conn(|conn| {
            let removed = roots_repo::list(conn)?.remove(0);
            roots_repo::remove(conn, removed.id)
        })
        .unwrap();
        std::fs::create_dir_all(home.join(".codex")).unwrap();
        seed_roots_under(&db, &home).unwrap();

        assert_eq!(root_paths(&db), under(&home, &[".claude"]));
    }

    #[test]
    fn an_install_seeded_under_the_old_key_picks_up_the_new_folders_once() {
        let db = Db::open_in_memory().unwrap();
        let (_dir, home) = home_with(&[".claude", ".agents", "Documents/GitHub"]);
        db.with_conn(|conn| {
            set_meta(conn, "default_roots_seeded", "true")?;
            roots_repo::insert(conn, &home.join(".claude").to_string_lossy(), 0)
        })
        .unwrap();

        seed_roots_under(&db, &home).unwrap();

        assert_eq!(
            root_paths(&db),
            under(&home, &[".claude", ".agents", "Documents/GitHub"])
        );
        assert_eq!(
            db.with_conn(|conn| get_meta(conn, META_DEFAULT_ROOTS_SEEDED))
                .unwrap()
                .as_deref(),
            Some("true")
        );
    }

    #[test]
    fn skips_a_candidate_overlapping_an_existing_root() {
        let db = Db::open_in_memory().unwrap();
        let (_dir, home) = home_with(&[".claude", "Documents/GitHub/app", "src"]);
        db.with_conn(|conn| {
            roots_repo::insert(conn, &home.join("Documents").to_string_lossy(), 0)?;
            roots_repo::insert(conn, &home.join("src/nested").to_string_lossy(), 0)
        })
        .unwrap();

        seed_roots_under(&db, &home).unwrap();

        assert_eq!(
            root_paths(&db),
            under(&home, &[".claude", "Documents", "src/nested"])
        );
    }

    #[test]
    fn never_inserts_one_directory_under_two_spellings() {
        let db = Db::open_in_memory().unwrap();
        let (_dir, home) = home_with(&["Documents/Github"]);
        // only meaningful where the disk folds case, as macOS does by default
        if !home.join("Documents/GitHub").is_dir() {
            return;
        }
        db.with_conn(|conn| {
            roots_repo::insert(conn, &home.join("Documents/Github").to_string_lossy(), 0)
        })
        .unwrap();

        seed_roots_under(&db, &home).unwrap();

        assert_eq!(root_paths(&db), under(&home, &["Documents/Github"]));
    }

    #[test]
    fn a_nested_directory_is_refused_as_a_second_root() {
        let db = Db::open_in_memory().unwrap();
        let dir = tempdir().unwrap();
        let parent = dir.path().canonicalize().unwrap();
        std::fs::create_dir_all(parent.join("child")).unwrap();

        db.with_conn(|conn| roots_repo::insert(conn, &parent.to_string_lossy(), 0))
            .unwrap();

        let existing = db.with_conn(roots_repo::list).unwrap();
        assert!(conflicts_with_existing_root(&parent.join("child"), &existing).is_some());
    }
}
