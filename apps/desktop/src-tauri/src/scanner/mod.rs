pub mod hash;
pub mod incremental;
pub mod targets;
pub mod walk;

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

use crate::db::files_repo::{self, FileRecord};
use crate::db::roots_repo::Root;
use crate::db::{now_ms, Db};
use crate::error::AppResult;
use incremental::{classify_change, ChangeKind, Stat};
use walk::{project_dir_of, walk_root, WalkEntry};

const BATCH_SIZE: usize = 500;

#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStats {
    pub seen: i64,
    pub hashed: i64,
    pub added: i64,
    pub changed: i64,
    pub removed: i64,
}

#[derive(Debug, Clone, Default)]
pub struct ScanOutcome {
    pub stats: ScanStats,
    pub touched_ids: Vec<i64>,
    pub cancelled: bool,
}

pub fn create_scan_row(db: &Db) -> AppResult<i64> {
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO scans (started_at, status) VALUES (?1, 'running')",
            [now_ms()],
        )?;
        Ok(conn.last_insert_rowid())
    })
}

pub fn finish_scan_row(db: &Db, scan_id: i64, status: &str, stats: &ScanStats) -> AppResult<()> {
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE scans SET finished_at = ?2, status = ?3, seen = ?4, hashed = ?5,
                              added = ?6, changed = ?7, removed = ?8
             WHERE id = ?1",
            rusqlite::params![
                scan_id,
                now_ms(),
                status,
                stats.seen,
                stats.hashed,
                stats.added,
                stats.changed,
                stats.removed,
            ],
        )?;
        Ok(())
    })
}

struct Prepared {
    record: FileRecord,
    change: ChangeKind,
    hashed: bool,
}

fn prepare(
    entry: WalkEntry,
    root: &Root,
    root_path: &Path,
    previous: Option<&(i64, Stat, String)>,
) -> Option<Prepared> {
    let stat = Stat {
        size: entry.size,
        mtime_ns: entry.mtime_ns,
    };
    let change = classify_change(previous.map(|(_, stat, _)| *stat), stat);

    let (hash, hashed) = match (change, previous) {
        (ChangeKind::Unchanged, Some((_, _, hash))) => (hash.clone(), false),
        _ => (hash::hash_file(&entry.path, entry.size as u64).ok()?, true),
    };

    let rel_path = entry
        .path
        .strip_prefix(root_path)
        .unwrap_or(&entry.path)
        .to_string_lossy()
        .into_owned();

    Some(Prepared {
        record: FileRecord {
            root_id: root.id,
            path: entry.path.to_string_lossy().into_owned(),
            rel_path,
            kind: entry.kind,
            project_dir: project_dir_of(&entry.path, root_path),
            size: entry.size,
            mtime_ns: entry.mtime_ns,
            hash,
            is_symlink: entry.is_symlink,
            symlink_target: entry.symlink_target,
        },
        change,
        hashed,
    })
}

fn flush(
    db: &Db,
    batch: &mut Vec<Prepared>,
    scan_id: i64,
    stats: &mut ScanStats,
    touched: &mut Vec<i64>,
) -> AppResult<()> {
    if batch.is_empty() {
        return Ok(());
    }
    let now = now_ms();
    db.with_tx(|tx| {
        for prepared in batch.iter() {
            let id = files_repo::upsert(tx, &prepared.record, scan_id, now)?;
            match prepared.change {
                ChangeKind::Added => {
                    stats.added += 1;
                    touched.push(id);
                }
                ChangeKind::Changed => {
                    stats.changed += 1;
                    touched.push(id);
                }
                ChangeKind::Unchanged => {}
            }
        }
        Ok(())
    })?;
    batch.clear();
    Ok(())
}

fn scan_root(
    db: &Db,
    root: &Root,
    scan_id: i64,
    cancel: &AtomicBool,
    outcome: &mut ScanOutcome,
    on_progress: &mut dyn FnMut(ScanStats),
) -> AppResult<()> {
    let root_path = Path::new(&root.path);
    if !root_path.is_dir() {
        return Ok(());
    }

    let previous = db.with_conn(|conn| files_repo::stats_by_path(conn, root.id))?;
    let (sender, receiver) = crossbeam_channel::bounded::<Prepared>(2048);

    let result = std::thread::scope(|scope| -> AppResult<()> {
        scope.spawn(|| {
            let sender = sender;
            walk_root(root_path, cancel, |entry| {
                let key = entry.path.to_string_lossy().into_owned();
                if let Some(prepared) = prepare(entry, root, root_path, previous.get(&key)) {
                    let _ = sender.send(prepared);
                }
            });
        });

        let mut batch: Vec<Prepared> = Vec::with_capacity(BATCH_SIZE);
        for prepared in receiver.iter() {
            outcome.stats.seen += 1;
            if prepared.hashed {
                outcome.stats.hashed += 1;
            }
            batch.push(prepared);

            if batch.len() >= BATCH_SIZE {
                flush(
                    db,
                    &mut batch,
                    scan_id,
                    &mut outcome.stats,
                    &mut outcome.touched_ids,
                )?;
                on_progress(outcome.stats);
            }
        }
        flush(
            db,
            &mut batch,
            scan_id,
            &mut outcome.stats,
            &mut outcome.touched_ids,
        )
    });
    result?;

    if cancel.load(Ordering::Relaxed) {
        outcome.cancelled = true;
        return Ok(());
    }

    let removed =
        db.with_conn(|conn| files_repo::mark_missing_deleted(conn, root.id, scan_id, now_ms()))?;
    outcome.stats.removed += removed.len() as i64;
    outcome.touched_ids.extend(removed);
    on_progress(outcome.stats);
    Ok(())
}

pub fn run_scan(
    db: &Db,
    roots: &[Root],
    scan_id: i64,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(ScanStats),
) -> AppResult<ScanOutcome> {
    let mut outcome = ScanOutcome::default();

    for root in roots {
        if cancel.load(Ordering::Relaxed) {
            outcome.cancelled = true;
            break;
        }
        scan_root(db, root, scan_id, cancel, &mut outcome, &mut on_progress)?;
    }

    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::FileFilter;
    use crate::db::roots_repo;
    use std::fs;
    use tempfile::{tempdir, TempDir};

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn setup() -> (Db, TempDir, Root) {
        let dir = tempdir().unwrap();
        let db = Db::open_in_memory().unwrap();
        let path = dir.path().to_string_lossy().into_owned();
        let id = db
            .with_conn(|conn| roots_repo::insert(conn, &path, 0))
            .unwrap();
        let root = db
            .with_conn(|conn| roots_repo::get(conn, id))
            .unwrap()
            .unwrap();
        (db, dir, root)
    }

    fn scan(db: &Db, root: &Root) -> ScanOutcome {
        let scan_id = create_scan_row(db).unwrap();
        let cancel = AtomicBool::new(false);
        run_scan(db, std::slice::from_ref(root), scan_id, &cancel, |_| {}).unwrap()
    }

    #[test]
    fn indexes_every_target_of_a_root() {
        let (db, dir, root) = setup();
        write(&dir.path().join("CLAUDE.md"), "# claude");
        write(&dir.path().join(".claude/skills/demo/SKILL.md"), "# skill");
        write(&dir.path().join("README.md"), "ignored");

        let outcome = scan(&db, &root);

        assert_eq!(outcome.stats.seen, 2);
        assert_eq!(outcome.stats.added, 2);
        assert_eq!(outcome.stats.hashed, 2);
        assert_eq!(outcome.touched_ids.len(), 2);
        let files = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn a_second_scan_rehashes_nothing() {
        let (db, dir, root) = setup();
        write(&dir.path().join("CLAUDE.md"), "# claude");
        scan(&db, &root);

        let second = scan(&db, &root);

        assert_eq!(second.stats.seen, 1);
        assert_eq!(second.stats.hashed, 0);
        assert_eq!(second.stats.added, 0);
        assert_eq!(second.stats.changed, 0);
        assert!(second.touched_ids.is_empty());
    }

    #[test]
    fn an_edited_file_is_rehashed_and_reported_changed() {
        let (db, dir, root) = setup();
        let path = dir.path().join("CLAUDE.md");
        write(&path, "# claude");
        scan(&db, &root);

        write(&path, "# claude edited");
        let second = scan(&db, &root);

        assert_eq!(second.stats.changed, 1);
        assert_eq!(second.stats.hashed, 1);
        let files = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        assert_eq!(files[0].hash, hash::hash_bytes(b"# claude edited"));
    }

    #[test]
    fn a_removed_file_is_soft_deleted() {
        let (db, dir, root) = setup();
        let path = dir.path().join("CLAUDE.md");
        write(&path, "# claude");
        scan(&db, &root);

        fs::remove_file(&path).unwrap();
        let second = scan(&db, &root);

        assert_eq!(second.stats.removed, 1);
        assert_eq!(second.touched_ids.len(), 1);
        assert!(db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn records_the_project_dir_of_a_git_repo() {
        let (db, dir, root) = setup();
        fs::create_dir_all(dir.path().join("repo/.git")).unwrap();
        write(&dir.path().join("repo/packages/api/AGENTS.md"), "a");
        write(&dir.path().join("loose/AGENTS.md"), "b");

        scan(&db, &root);

        let files = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        let in_repo = files.iter().find(|f| f.path.contains("packages")).unwrap();
        let loose = files.iter().find(|f| f.path.contains("loose")).unwrap();
        assert!(in_repo.project_dir.as_ref().unwrap().ends_with("repo"));
        assert_eq!(loose.project_dir, None);
    }

    #[test]
    fn a_cancelled_scan_reports_itself_and_deletes_nothing() {
        let (db, dir, root) = setup();
        write(&dir.path().join("CLAUDE.md"), "# claude");
        scan(&db, &root);
        fs::remove_file(dir.path().join("CLAUDE.md")).unwrap();

        let scan_id = create_scan_row(&db).unwrap();
        let cancel = AtomicBool::new(true);
        let outcome = run_scan(&db, std::slice::from_ref(&root), scan_id, &cancel, |_| {}).unwrap();

        assert!(outcome.cancelled);
        assert_eq!(outcome.stats.removed, 0);
        assert_eq!(
            db.with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
                .unwrap()
                .len(),
            1,
            "a cancelled scan leaves the index untouched"
        );
    }

    #[test]
    fn reports_progress_while_it_walks() {
        let (db, dir, root) = setup();
        for index in 0..3 {
            write(&dir.path().join(format!("p{index}/CLAUDE.md")), "x");
        }

        let scan_id = create_scan_row(&db).unwrap();
        let cancel = AtomicBool::new(false);
        let mut reports = Vec::new();
        run_scan(
            &db,
            std::slice::from_ref(&root),
            scan_id,
            &cancel,
            |stats| reports.push(stats),
        )
        .unwrap();

        assert_eq!(reports.last().unwrap().seen, 3);
    }

    #[test]
    fn a_missing_root_directory_is_skipped() {
        let (db, dir, root) = setup();
        drop(dir);

        let outcome = scan(&db, &root);

        assert_eq!(outcome.stats.seen, 0);
    }

    #[test]
    fn the_scan_row_records_its_final_stats() {
        let (db, dir, root) = setup();
        write(&dir.path().join("CLAUDE.md"), "# claude");
        let scan_id = create_scan_row(&db).unwrap();
        let cancel = AtomicBool::new(false);

        let outcome = run_scan(&db, std::slice::from_ref(&root), scan_id, &cancel, |_| {}).unwrap();
        finish_scan_row(&db, scan_id, "done", &outcome.stats).unwrap();

        let (status, seen): (String, i64) = db
            .with_conn(|conn| {
                Ok(conn.query_row(
                    "SELECT status, seen FROM scans WHERE id = ?1",
                    [scan_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )?)
            })
            .unwrap();
        assert_eq!((status.as_str(), seen), ("done", 1));
    }
}
