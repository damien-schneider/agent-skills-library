use std::collections::{BTreeSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer_opt, DebounceEventResult, Debouncer, NoCache};
use tauri::AppHandle;

use crate::db::roots_repo::Root;
use crate::db::{aliases_repo, files_repo, now_ms, Db};
use crate::error::{AppError, AppResult};
use crate::events;
use crate::scanner::placement::{home_of, owning_root, place, Reach};
use crate::scanner::refs;
use crate::scanner::store::{record_for, store, Indexable};
use crate::scanner::targets::{classify, is_skipped_below};
use crate::scanner::walk::describe;

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

/// The path stopped resolving. When it carried a row, the file may still be reachable
/// through that row's other paths: they are handed back to be indexed afresh, which
/// is where a full scan would land too.
fn forget_path(db: &Db, key: &str, touched: &mut BTreeSet<i64>) -> AppResult<Vec<PathBuf>> {
    db.with_tx(|tx| {
        touched.extend(aliases_repo::forget(tx, key)?);
        let Some(id) = files_repo::mark_deleted_by_path(tx, key, now_ms())? else {
            return Ok(Vec::new());
        };
        touched.insert(id);
        let orphans = aliases_repo::take_of(tx, id)?;
        Ok(orphans.into_iter().map(PathBuf::from).collect())
    })
}

/// Other indexed paths still leading to `real`: an event names one path, the row
/// may live at another.
fn known_reaches(db: &Db, real: &Path, event_key: &str, roots: &[Root]) -> AppResult<Vec<Reach>> {
    let known = db.with_conn(|conn| aliases_repo::paths_reaching(conn, &real.to_string_lossy()))?;

    Ok(known
        .into_iter()
        .filter(|known| known.path != event_key)
        .filter(|known| roots.iter().any(|root| root.id == known.root_id))
        .map(|known| Reach {
            path: PathBuf::from(known.path),
            root_id: known.root_id,
        })
        .filter(|reach| {
            reach
                .path
                .canonicalize()
                .is_ok_and(|resolved| resolved == real)
        })
        .collect())
}

/// Answers with the paths that have to be looked at next, if any.
fn reindex_path(
    db: &Db,
    roots: &[Root],
    path: &Path,
    scan_id: i64,
    touched: &mut BTreeSet<i64>,
) -> AppResult<Vec<PathBuf>> {
    if classify(path).is_none() {
        return Ok(Vec::new());
    }
    let Some(root) = owning_root(roots, path) else {
        return Ok(Vec::new());
    };
    // same answer as the walker, or the next scan would retire what is indexed here
    if is_skipped_below(Path::new(&root.path), path) {
        return Ok(Vec::new());
    }
    let key = path.to_string_lossy().into_owned();
    let Ok(real) = path.canonicalize() else {
        return forget_path(db, &key, touched);
    };

    let mut reaches = vec![Reach {
        path: path.to_path_buf(),
        root_id: root.id,
    }];
    if home_of(&real, roots).is_none() {
        reaches.extend(known_reaches(db, &real, &key, roots)?);
    }
    let Some(placement) = place(&real, &reaches, roots) else {
        return Ok(Vec::new());
    };
    let Some(home) = roots.iter().find(|root| root.id == placement.root_id) else {
        return Ok(Vec::new());
    };
    let Some(entry) = describe(&placement.path, placement.kind) else {
        return Ok(Vec::new());
    };
    let Ok(indexed) = refs::index_file(&entry.path, entry.size as u64, entry.kind) else {
        return Ok(Vec::new());
    };

    let previous =
        db.with_conn(|conn| files_repo::find_by_path(conn, &entry.path.to_string_lossy()))?;
    let settled = previous.is_some_and(|row| {
        row.deleted_at.is_none()
            && row.hash == indexed.hash
            && placement
                .aliases
                .iter()
                .all(|alias| row.aliases.contains(&alias.path))
    });
    if settled {
        return Ok(Vec::new());
    }

    let item = Indexable {
        record: record_for(&entry, home, indexed.hash),
        content: Some(indexed.content),
        aliases: placement.aliases,
    };
    let stored = db.with_tx(|tx| store(tx, &item, scan_id, now_ms()))?;
    touched.insert(stored.id);
    touched.extend(stored.retired);
    touched.extend(stored.relinked);
    Ok(Vec::new())
}

/// Re-indexes exactly the touched paths; the ids feed `index:updated`. A path that
/// is only an alias updates the row of the file it reaches, never a row of its own.
pub fn reindex(db: &Db, roots: &[Root], paths: &BTreeSet<PathBuf>) -> AppResult<Vec<i64>> {
    let scan_id = db.with_conn(files_repo::latest_scan_id)?;
    let mut touched = BTreeSet::new();

    let mut pending: VecDeque<PathBuf> = paths.iter().cloned().collect();
    while let Some(path) = pending.pop_front() {
        pending.extend(reindex_path(db, roots, &path, scan_id, &mut touched)?);
    }

    Ok(touched.into_iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::{FileFilter, FileRow};
    use crate::db::roots_repo;
    use crate::scanner::{create_scan_row, run_scan};
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use tempfile::tempdir;

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn link(target: impl AsRef<Path>, at: &Path) {
        fs::create_dir_all(at.parent().unwrap()).unwrap();
        std::os::unix::fs::symlink(target, at).unwrap();
    }

    fn live(db: &Db) -> Vec<FileRow> {
        db.with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap()
    }

    fn text(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

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
    fn ignores_what_the_walker_would_skip() {
        let (db, dir, roots) = setup();
        let base = dir.path().canonicalize().unwrap();
        let vendor = base.join(".claude/plugins/cache/x/skills/c/SKILL.md");
        let dependency = base.join("node_modules/pkg/CLAUDE.md");
        write(&vendor, "# vendor");
        write(&dependency, "# dependency");

        assert!(reindex_one(&db, &roots, &vendor).is_empty());
        assert!(reindex_one(&db, &roots, &dependency).is_empty());
        assert!(live(&db).is_empty());
    }

    #[test]
    fn an_edit_of_a_real_file_updates_its_one_row_and_keeps_its_aliases() {
        let (db, dir, roots) = setup();
        let base = dir.path().canonicalize().unwrap();
        let real = base.join(".agents/skills/a/SKILL.md");
        write(&real, "# a");
        link("../../.agents/skills/a", &base.join(".claude/skills/a"));
        let scan_id = create_scan_row(&db).unwrap();
        run_scan(&db, &roots, scan_id, &AtomicBool::new(false), |_| {}).unwrap();
        let before = live(&db);

        write(&real, "---\ndescription: Edited\n---\n# a");
        let touched = reindex_one(&db, &roots, &real);

        let after = live(&db);
        assert_eq!(touched, [before[0].id]);
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].path, text(&real));
        assert_ne!(after[0].hash, before[0].hash);
        assert_eq!(after[0].description.as_deref(), Some("Edited"));
        assert_eq!(
            after[0].aliases,
            [text(&base.join(".claude/skills/a/SKILL.md"))]
        );
    }

    #[test]
    fn an_event_for_an_alias_path_never_creates_a_second_row() {
        let (db, dir, roots) = setup();
        let base = dir.path().canonicalize().unwrap();
        let real = base.join(".agents/skills/a/SKILL.md");
        let alias = base.join(".claude/skills/a/SKILL.md");
        write(&real, "# a");
        link("../../.agents/skills/a", &base.join(".claude/skills/a"));

        let touched = reindex_one(&db, &roots, &alias);

        let rows = live(&db);
        assert_eq!(rows.len(), 1);
        assert_eq!(touched, [rows[0].id]);
        assert_eq!(rows[0].path, text(&real));
        assert_eq!(rows[0].aliases, [text(&alias)]);
        assert!(reindex_one(&db, &roots, &alias).is_empty());
        assert!(reindex_one(&db, &roots, &real).is_empty());
    }

    #[test]
    fn a_file_replaced_by_a_link_to_another_stops_being_a_row() {
        let (db, dir, roots) = setup();
        let base = dir.path().canonicalize().unwrap();
        let canonical = base.join("a/AGENTS.md");
        let member = base.join("b/AGENTS.md");
        write(&canonical, "# shared");
        write(&member, "# drifted");
        let canonical_id = reindex_one(&db, &roots, &canonical)[0];
        let member_id = reindex_one(&db, &roots, &member)[0];

        fs::remove_file(&member).unwrap();
        link(&canonical, &member);
        let touched = reindex_one(&db, &roots, &member);

        let rows = live(&db);
        assert_eq!(touched, [canonical_id, member_id]);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, canonical_id);
        assert_eq!(rows[0].aliases, [text(&member)]);
    }

    #[test]
    fn a_removed_link_is_dropped_from_the_file_it_reached() {
        let (db, dir, roots) = setup();
        let base = dir.path().canonicalize().unwrap();
        let alias = base.join(".claude/skills/a/SKILL.md");
        write(&base.join(".agents/skills/a/SKILL.md"), "# a");
        link("../../.agents/skills/a", &base.join(".claude/skills/a"));
        let id = reindex_one(&db, &roots, &alias)[0];

        fs::remove_file(base.join(".claude/skills/a")).unwrap();
        let touched = reindex_one(&db, &roots, &alias);

        let rows = live(&db);
        assert_eq!(touched, [id]);
        assert_eq!(rows.len(), 1);
        assert!(rows[0].aliases.is_empty());
    }

    #[test]
    fn deleting_the_real_file_retires_the_row_and_its_dangling_aliases() {
        let (db, dir, roots) = setup();
        let base = dir.path().canonicalize().unwrap();
        let real = base.join(".agents/skills/a/SKILL.md");
        write(&real, "# a");
        link("../../.agents/skills/a", &base.join(".claude/skills/a"));
        let id = reindex_one(&db, &roots, &base.join(".claude/skills/a/SKILL.md"))[0];

        fs::remove_file(&real).unwrap();
        let touched = reindex_one(&db, &roots, &real);

        assert_eq!(touched, [id]);
        assert!(live(&db).is_empty());
        let aliases: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row("SELECT COUNT(*) FROM file_aliases", [], |row| row.get(0))?)
            })
            .unwrap();
        assert_eq!(aliases, 0);
    }

    /// `first/skills/s` and `second/skills/s` both link a skill that lives outside the root.
    fn two_links_outside() -> (Db, tempfile::TempDir, Vec<Root>, PathBuf, PathBuf) {
        let dir = tempdir().unwrap();
        let base = dir.path().canonicalize().unwrap();
        let rooted = base.join("rooted");
        let target = base.join("outside/s");
        write(&target.join("SKILL.md"), "# s");
        link(&target, &rooted.join("first/skills/s"));
        link(&target, &rooted.join("second/skills/s"));

        let db = Db::open_in_memory().unwrap();
        db.with_conn(|conn| roots_repo::insert(conn, &rooted.to_string_lossy(), 0))
            .unwrap();
        let roots = db.with_conn(roots_repo::list).unwrap();
        (
            db,
            dir,
            roots,
            rooted.join("first/skills/s/SKILL.md"),
            rooted.join("second/skills/s/SKILL.md"),
        )
    }

    #[test]
    fn links_to_one_outside_target_share_a_row_whatever_the_event_order() {
        for first_then_second in [true, false] {
            let (db, _dir, roots, first, second) = two_links_outside();
            let order = if first_then_second {
                [&first, &second]
            } else {
                [&second, &first]
            };

            for path in order {
                reindex_one(&db, &roots, path);

                assert_eq!(live(&db).len(), 1, "never a second row for the same file");
            }

            let rows = live(&db);
            assert_eq!(rows[0].path, text(&first));
            assert_eq!(rows[0].aliases, [text(&second)]);
        }
    }

    #[test]
    fn when_the_link_carrying_the_row_goes_the_next_one_takes_over() {
        let (db, _dir, roots, first, second) = two_links_outside();
        reindex(
            &db,
            &roots,
            &BTreeSet::from([first.clone(), second.clone()]),
        )
        .unwrap();

        fs::remove_file(first.parent().unwrap()).unwrap();
        reindex_one(&db, &roots, &first);

        let rows = live(&db);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].path, text(&second));
        assert!(rows[0].aliases.is_empty());
    }
}
