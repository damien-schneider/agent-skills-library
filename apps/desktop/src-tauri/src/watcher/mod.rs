use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer_opt, DebounceEventResult, Debouncer, NoCache};
use tauri::AppHandle;

use crate::db::files_repo::{self, FileRecord};
use crate::db::roots_repo::Root;
use crate::db::{now_ms, Db};
use crate::error::{AppError, AppResult};
use crate::events;
use crate::fsops;
use crate::scanner::hash::hash_file;
use crate::scanner::targets::classify;
use crate::scanner::walk::project_dir_of;

/// FSEvents/inotify fire per keystroke in some editors; coalesce before touching the DB.
const DEBOUNCE: Duration = Duration::from_millis(500);

pub struct WatcherHandle {
    _debouncer: Debouncer<RecommendedWatcher, NoCache>,
}

pub fn start(app: AppHandle, db: Arc<Db>, roots: Vec<Root>) -> AppResult<WatcherHandle> {
    let watched: Vec<Root> = roots.into_iter().filter(|root| root.enabled).collect();

    let handler_db = Arc::clone(&db);
    let handler_roots = watched.clone();
    let mut debouncer = new_debouncer_opt::<_, RecommendedWatcher, NoCache>(
        DEBOUNCE,
        None,
        move |result: DebounceEventResult| {
            let Ok(debounced) = result else {
                return;
            };
            let paths: BTreeSet<PathBuf> = debounced
                .iter()
                .flat_map(|event| event.paths.clone())
                .filter(|path| classify(path).is_some())
                .collect();

            if paths.is_empty() {
                return;
            }
            match reindex(&handler_db, &handler_roots, &paths) {
                Ok(ids) => events::emit_index_updated(&app, ids),
                Err(error) => log::warn!("watcher reindex failed: {error}"),
            }
        },
        // NoCache, not the platform default: the file-id map walks every watched
        // tree up front, which costs ~1 GB over a GitHub directory.
        NoCache::new(),
        notify::Config::default(),
    )
    .map_err(|error| AppError::internal(format!("watcher failed to start: {error}")))?;

    for root in &watched {
        debouncer
            .watch(Path::new(&root.path), RecursiveMode::Recursive)
            .map_err(|error| {
                AppError::internal(format!("watching {} failed: {error}", root.path))
            })?;
    }

    Ok(WatcherHandle {
        _debouncer: debouncer,
    })
}

fn owning_root<'a>(roots: &'a [Root], path: &Path) -> Option<&'a Root> {
    roots
        .iter()
        .filter(|root| path.starts_with(Path::new(&root.path)))
        .max_by_key(|root| root.path.len())
}

/// Re-indexes exactly the touched paths; the ids feed `index:updated`.
pub fn reindex(db: &Db, roots: &[Root], paths: &BTreeSet<PathBuf>) -> AppResult<Vec<i64>> {
    let mut touched = Vec::new();
    let scan_id = db.with_conn(files_repo::latest_scan_id)?;

    for path in paths {
        let Some(kind) = classify(path) else {
            continue;
        };
        let Some(root) = owning_root(roots, path) else {
            continue;
        };
        let key = path.to_string_lossy().into_owned();

        if !path.exists() {
            if let Some(id) =
                db.with_conn(|conn| files_repo::mark_deleted_by_path(conn, &key, now_ms()))?
            {
                touched.push(id);
            }
            continue;
        }

        let Ok(stat) = fsops::stat(path) else {
            continue;
        };
        let Ok(hash) = hash_file(path, stat.size as u64) else {
            continue;
        };

        let previous = db.with_conn(|conn| files_repo::find_by_path(conn, &key))?;
        if previous
            .as_ref()
            .is_some_and(|row| row.hash == hash && row.deleted_at.is_none())
        {
            continue;
        }

        let root_path = Path::new(&root.path);
        let link_metadata = std::fs::symlink_metadata(path).ok();
        let is_symlink = link_metadata.is_some_and(|metadata| metadata.is_symlink());
        let record = FileRecord {
            root_id: root.id,
            path: key.clone(),
            rel_path: path
                .strip_prefix(root_path)
                .unwrap_or(path)
                .to_string_lossy()
                .into_owned(),
            kind,
            project_dir: project_dir_of(path, root_path),
            size: stat.size,
            mtime_ns: stat.mtime_ns,
            hash,
            is_symlink,
            symlink_target: is_symlink
                .then(|| std::fs::read_link(path).ok())
                .flatten()
                .map(|target| target.to_string_lossy().into_owned()),
        };

        let id = db.with_conn(|conn| files_repo::upsert(conn, &record, scan_id, now_ms()))?;
        touched.push(id);
    }

    Ok(touched)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::FileFilter;
    use crate::db::roots_repo;
    use std::fs;
    use tempfile::tempdir;

    fn setup() -> (Db, tempfile::TempDir, Vec<Root>) {
        let dir = tempdir().unwrap();
        let db = Db::open_in_memory().unwrap();
        let path = dir
            .path()
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let id = db
            .with_conn(|conn| roots_repo::insert(conn, &path, 0))
            .unwrap();
        let roots = db.with_conn(roots_repo::list).unwrap();
        assert_eq!(roots[0].id, id);
        (db, dir, roots)
    }

    fn reindex_one(db: &Db, roots: &[Root], path: &Path) -> Vec<i64> {
        reindex(db, roots, &BTreeSet::from([path.to_path_buf()])).unwrap()
    }

    #[test]
    fn indexes_a_newly_created_target() {
        let (db, dir, roots) = setup();
        let path = dir.path().canonicalize().unwrap().join("CLAUDE.md");
        fs::write(&path, "# new").unwrap();

        let touched = reindex_one(&db, &roots, &path);

        assert_eq!(touched.len(), 1);
        let files = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].rel_path, "CLAUDE.md");
    }

    #[test]
    fn an_unchanged_file_reports_nothing() {
        let (db, dir, roots) = setup();
        let path = dir.path().canonicalize().unwrap().join("CLAUDE.md");
        fs::write(&path, "# new").unwrap();
        reindex_one(&db, &roots, &path);

        assert!(reindex_one(&db, &roots, &path).is_empty());
    }

    #[test]
    fn an_edited_file_is_reported() {
        let (db, dir, roots) = setup();
        let path = dir.path().canonicalize().unwrap().join("CLAUDE.md");
        fs::write(&path, "# new").unwrap();
        reindex_one(&db, &roots, &path);

        fs::write(&path, "# edited").unwrap();
        let touched = reindex_one(&db, &roots, &path);

        assert_eq!(touched.len(), 1);
    }

    #[test]
    fn a_deleted_file_is_soft_deleted() {
        let (db, dir, roots) = setup();
        let path = dir.path().canonicalize().unwrap().join("CLAUDE.md");
        fs::write(&path, "# new").unwrap();
        reindex_one(&db, &roots, &path);

        fs::remove_file(&path).unwrap();
        let touched = reindex_one(&db, &roots, &path);

        assert_eq!(touched.len(), 1);
        assert!(db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn ignores_paths_that_are_not_targets() {
        let (db, dir, roots) = setup();
        let path = dir.path().canonicalize().unwrap().join("README.md");
        fs::write(&path, "# nope").unwrap();

        assert!(reindex_one(&db, &roots, &path).is_empty());
    }

    #[test]
    fn ignores_paths_outside_every_root() {
        let (db, _dir, roots) = setup();
        let outside = tempdir().unwrap();
        let path = outside.path().canonicalize().unwrap().join("CLAUDE.md");
        fs::write(&path, "# outside").unwrap();

        assert!(reindex_one(&db, &roots, &path).is_empty());
    }

    #[test]
    fn picks_the_deepest_owning_root() {
        let outer = Root {
            id: 1,
            path: "/repo".into(),
            enabled: true,
            added_at: 0,
        };
        let inner = Root {
            id: 2,
            path: "/repo/nested".into(),
            enabled: true,
            added_at: 0,
        };

        let roots = [outer, inner];
        let owner = owning_root(&roots, Path::new("/repo/nested/CLAUDE.md"));

        assert_eq!(owner.map(|root| root.id), Some(2));
    }
}
