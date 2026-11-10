pub mod frontmatter;
pub mod hash;
pub mod incremental;
pub mod placement;
pub mod refs;
pub mod store;
pub mod targets;
pub mod walk;

#[cfg(test)]
mod alias_tests;

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

use crate::db::aliases_repo::{self, AliasRecord};
use crate::db::files_repo::{self, IndexedFile};
use crate::db::roots_repo::{self, Root};
use crate::db::{now_ms, Db};
use crate::error::AppResult;
use incremental::{classify_change, ChangeKind, Stat};
use placement::{home_of, place, Reach};
use store::{record_for, store, Indexable};
use walk::{describe, walk_root, worker_threads, WalkEntry};

const BATCH_SIZE: usize = 500;
/// The walk is the slow part of a big tree: the counter has to move while it runs.
const PROGRESS_EVERY: i64 = 100;

#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStats {
    /// Real files found — a file reached through three paths counts once.
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

struct Walked {
    entry: WalkEntry,
    root_id: i64,
}

/// Every walked path, grouped by the real file it reaches. Nothing is indexed until
/// all roots are walked: a file's row depends on every path leading to it, and
/// those can sit in different roots.
type Found = HashMap<PathBuf, Vec<Walked>>;

struct Job<'a> {
    entry: WalkEntry,
    root: &'a Root,
    aliases: Vec<AliasRecord>,
}

struct Prepared {
    item: Indexable,
    change: ChangeKind,
}

fn walk_into(
    root: &Root,
    cancel: &AtomicBool,
    found: &mut Found,
    stats: &mut ScanStats,
    on_progress: &mut dyn FnMut(ScanStats),
) {
    let (sender, receiver) = crossbeam_channel::bounded::<WalkEntry>(2048);

    std::thread::scope(|scope| {
        scope.spawn(move || {
            walk_root(Path::new(&root.path), cancel, |entry| {
                let _ = sender.send(entry);
            });
        });

        for entry in receiver.iter() {
            let reached = found.entry(entry.real_path.clone()).or_default();
            if reached.is_empty() {
                stats.seen += 1;
                if stats.seen % PROGRESS_EVERY == 0 {
                    on_progress(*stats);
                }
            }
            reached.push(Walked {
                entry,
                root_id: root.id,
            });
        }
    });
}

/// Paths the index already holds for `real` in enabled roots this scan leaves alone.
/// Without them a partial scan would index a second row for a file whose row lives
/// at an alias over there.
fn known_elsewhere(db: &Db, real: &Path, unscanned: &HashSet<i64>) -> AppResult<Vec<Reach>> {
    let known = db.with_conn(|conn| aliases_repo::paths_reaching(conn, &real.to_string_lossy()))?;

    Ok(known
        .into_iter()
        .filter(|known| unscanned.contains(&known.root_id))
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

fn resolve<'a>(
    db: &Db,
    found: Found,
    enabled: &'a [Root],
    scanned: &[&'a Root],
) -> AppResult<Vec<Job<'a>>> {
    let unscanned: HashSet<i64> = enabled
        .iter()
        .map(|root| root.id)
        .filter(|id| scanned.iter().all(|root| root.id != *id))
        .collect();
    let root_by_id = |id: i64| {
        enabled
            .iter()
            .chain(scanned.iter().copied())
            .find(|root| root.id == id)
    };

    let mut jobs = Vec::with_capacity(found.len());
    for (real, walked) in found {
        let mut reaches: Vec<Reach> = walked
            .iter()
            .map(|walked| Reach {
                path: walked.entry.path.clone(),
                root_id: walked.root_id,
            })
            .collect();
        if !unscanned.is_empty() && home_of(&real, enabled).is_none() {
            reaches.extend(known_elsewhere(db, &real, &unscanned)?);
        }

        let Some(placement) = place(&real, &reaches, enabled) else {
            continue;
        };
        let Some(root) = root_by_id(placement.root_id) else {
            continue;
        };
        // the row's path was walked, unless it sits in a root this scan left alone
        let entry = walked
            .into_iter()
            .map(|walked| walked.entry)
            .find(|entry| entry.path == placement.path)
            .or_else(|| describe(&placement.path, placement.kind));
        let Some(entry) = entry else {
            continue;
        };

        jobs.push(Job {
            entry,
            root,
            aliases: placement.aliases,
        });
    }
    Ok(jobs)
}

/// Reusing the stored hash also means reusing what was read from the file, so a row
/// whose references or description were never extracted is re-read even when its
/// bytes did not move.
fn reusable_hash(previous: Option<&IndexedFile>, stat: Stat) -> Option<String> {
    let previous = previous?;
    (previous.stat == stat && previous.is_fully_read()).then(|| previous.hash.clone())
}

fn prepare(job: Job, previous: Option<&IndexedFile>) -> Option<Prepared> {
    let stat = Stat {
        size: job.entry.size,
        mtime_ns: job.entry.mtime_ns,
    };
    let live = previous.filter(|previous| !previous.deleted);
    let change = classify_change(live.map(|previous| previous.stat), stat);

    let (hash, content) = match reusable_hash(previous, stat) {
        Some(hash) => (hash, None),
        None => {
            let size = job.entry.size as u64;
            let indexed = refs::index_file(&job.entry.path, size, job.entry.kind).ok()?;
            (indexed.hash, Some(indexed.content))
        }
    };

    Some(Prepared {
        item: Indexable {
            record: record_for(&job.entry, job.root, hash),
            content,
            aliases: job.aliases,
        },
        change,
    })
}

fn flush(
    db: &Db,
    batch: &mut Vec<Prepared>,
    scan_id: i64,
    outcome: &mut ScanOutcome,
) -> AppResult<()> {
    if batch.is_empty() {
        return Ok(());
    }
    let now = now_ms();
    db.with_tx(|tx| {
        for prepared in batch.iter() {
            let stored = store(tx, &prepared.item, scan_id, now)?;
            match prepared.change {
                ChangeKind::Added => outcome.stats.added += 1,
                ChangeKind::Changed => outcome.stats.changed += 1,
                ChangeKind::Unchanged => {}
            }
            if prepared.change != ChangeKind::Unchanged || stored.aliases_changed {
                outcome.touched_ids.push(stored.id);
            }
            outcome.stats.removed += stored.retired.len() as i64;
            outcome.touched_ids.extend(stored.retired);
            outcome.touched_ids.extend(stored.relinked);
        }
        Ok(())
    })?;
    batch.clear();
    Ok(())
}

fn index(
    db: &Db,
    jobs: Vec<Job>,
    scan_id: i64,
    cancel: &AtomicBool,
    outcome: &mut ScanOutcome,
    on_progress: &mut dyn FnMut(ScanStats),
) -> AppResult<()> {
    let previous = db.with_conn(files_repo::indexed_by_path)?;

    let (queue, jobs_left) = crossbeam_channel::unbounded::<Job>();
    for job in jobs {
        let _ = queue.send(job);
    }
    drop(queue);
    let (sender, receiver) = crossbeam_channel::bounded::<Prepared>(2048);

    std::thread::scope(|scope| -> AppResult<()> {
        // owned by this closure so an early return drops it and unblocks the workers
        let receiver = receiver;
        for _ in 0..worker_threads() {
            let (jobs_left, sender, previous) = (jobs_left.clone(), sender.clone(), &previous);
            scope.spawn(move || {
                for job in jobs_left.iter() {
                    if cancel.load(Ordering::Relaxed) {
                        break;
                    }
                    let key = job.entry.path.to_string_lossy().into_owned();
                    let Some(prepared) = prepare(job, previous.get(&key)) else {
                        continue;
                    };
                    if sender.send(prepared).is_err() {
                        break;
                    }
                }
            });
        }
        drop(sender);

        let mut batch: Vec<Prepared> = Vec::with_capacity(BATCH_SIZE);
        for prepared in receiver.iter() {
            if prepared.item.content.is_some() {
                outcome.stats.hashed += 1;
            }
            batch.push(prepared);

            if batch.len() >= BATCH_SIZE {
                flush(db, &mut batch, scan_id, outcome)?;
                on_progress(outcome.stats);
            }
        }
        flush(db, &mut batch, scan_id, outcome)
    })
}

/// Rows and aliases the walk of a root did not come across are gone from the disk.
fn retire_unseen(db: &Db, root: &Root, scan_id: i64, outcome: &mut ScanOutcome) -> AppResult<()> {
    let (removed, unlinked) = db.with_conn(|conn| {
        Ok((
            files_repo::mark_missing_deleted(conn, root.id, scan_id, now_ms())?,
            aliases_repo::prune_unseen(conn, root.id, scan_id)?,
        ))
    })?;
    outcome.stats.removed += removed.len() as i64;
    outcome.touched_ids.extend(removed);
    outcome.touched_ids.extend(unlinked);
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
    // a real path only carries its row inside an enabled root, scanned now or not
    let enabled = db.with_conn(roots_repo::list_enabled)?;

    let mut found = Found::new();
    let mut scanned: Vec<&Root> = Vec::with_capacity(roots.len());
    for root in roots {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        if !Path::new(&root.path).is_dir() {
            continue;
        }
        walk_into(
            root,
            cancel,
            &mut found,
            &mut outcome.stats,
            &mut on_progress,
        );
        scanned.push(root);
    }

    if !cancel.load(Ordering::Relaxed) {
        let jobs = resolve(db, found, &enabled, &scanned)?;
        index(db, jobs, scan_id, cancel, &mut outcome, &mut on_progress)?;
    }
    // a scan cut short has not seen everything: nothing may be retired on its word
    if cancel.load(Ordering::Relaxed) {
        outcome.cancelled = true;
        return Ok(outcome);
    }

    for root in scanned {
        retire_unseen(db, root, scan_id, &mut outcome)?;
    }
    outcome.touched_ids.sort_unstable();
    outcome.touched_ids.dedup();
    on_progress(outcome.stats);
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::FileFilter;
    use crate::db::links_repo;
    use std::fs;
    use tempfile::{tempdir, TempDir};

    fn links_of(db: &Db, rel_path: &str) -> links_repo::FileLinks {
        db.with_conn(|conn| {
            let files = files_repo::list(conn, &FileFilter::default())?;
            let file = files
                .iter()
                .find(|file| file.rel_path == rel_path)
                .expect("indexed file");
            links_repo::links_of(conn, file.id)
        })
        .unwrap()
    }

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
    fn indexes_the_references_between_two_scanned_files() {
        let (db, dir, root) = setup();
        write(
            &dir.path().join("CLAUDE.md"),
            "check react-doctor when touching React code",
        );
        write(
            &dir.path().join(".claude/skills/react-doctor/SKILL.md"),
            "# react doctor",
        );

        scan(&db, &root);

        let outgoing = links_of(&db, "CLAUDE.md").outgoing;

        assert_eq!(
            outgoing
                .iter()
                .map(|file| file.name.as_deref())
                .collect::<Vec<_>>(),
            vec![Some("react-doctor")]
        );
    }

    #[test]
    fn a_scan_re_reads_files_whose_references_were_never_extracted() {
        let (db, dir, root) = setup();
        write(&dir.path().join("CLAUDE.md"), "use `react-doctor`");
        write(
            &dir.path().join(".claude/skills/react-doctor/SKILL.md"),
            "# react doctor",
        );
        scan(&db, &root);

        db.with_conn(|conn| {
            conn.execute_batch("DELETE FROM file_refs; UPDATE files SET refs_hash = NULL;")?;
            Ok(())
        })
        .unwrap();

        let second = scan(&db, &root);

        assert_eq!(second.stats.changed, 0, "nothing on disk moved");
        assert_eq!(
            links_of(&db, "CLAUDE.md").outgoing.len(),
            1,
            "an index migrated in without references backfills itself"
        );
    }

    #[test]
    fn indexes_the_frontmatter_description_of_skills_agents_and_rules() {
        let (db, dir, root) = setup();
        write(
            &dir.path().join("skills/review/SKILL.md"),
            "---\nname: review\ndescription: >\n  Use when the user\n  asks for a review.\n---\n# Review",
        );
        write(
            &dir.path().join(".claude/agents/planner.md"),
            "---\ndescription: \"Plans: always first\"\n---\n",
        );
        write(
            &dir.path().join(".cursor/rules/style.mdc"),
            "---\ndescription: Style rules\nglobs: '*.ts'\n---\n",
        );
        write(
            &dir.path().join("skills/broken/SKILL.md"),
            "---\ndescription: Use when: unquoted colon\n---\n",
        );
        write(
            &dir.path().join("CLAUDE.md"),
            "---\ndescription: not a described kind\n---\n",
        );

        scan(&db, &root);

        let files = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        let description = |rel_path: &str| {
            files
                .iter()
                .find(|file| file.rel_path == rel_path)
                .expect("indexed file")
                .description
                .as_deref()
        };
        assert_eq!(
            description("skills/review/SKILL.md"),
            Some("Use when the user asks for a review.")
        );
        assert_eq!(
            description(".claude/agents/planner.md"),
            Some("Plans: always first")
        );
        assert_eq!(description(".cursor/rules/style.mdc"), Some("Style rules"));
        assert_eq!(description("skills/broken/SKILL.md"), None);
        assert_eq!(description("CLAUDE.md"), None);
    }

    #[test]
    fn a_scan_re_reads_files_whose_description_was_never_computed() {
        let (db, dir, root) = setup();
        write(
            &dir.path().join("skills/review/SKILL.md"),
            "---\ndescription: Use for reviews\n---\n",
        );
        scan(&db, &root);

        db.with_conn(|conn| {
            conn.execute_batch("UPDATE files SET description = NULL, description_hash = NULL;")?;
            Ok(())
        })
        .unwrap();

        let second = scan(&db, &root);

        assert_eq!(second.stats.changed, 0, "nothing on disk moved");
        assert_eq!(second.stats.hashed, 1);
        let files = db
            .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap();
        assert_eq!(
            files[0].description.as_deref(),
            Some("Use for reviews"),
            "an index migrated in without descriptions backfills itself"
        );
        assert_eq!(scan(&db, &root).stats.hashed, 0, "and only once");
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
    fn a_file_that_comes_back_is_reported_again() {
        let (db, dir, root) = setup();
        let path = dir.path().join("CLAUDE.md");
        write(&path, "# claude");
        let first = scan(&db, &root);
        let saved = dir.path().join("saved");
        fs::rename(&path, &saved).unwrap();
        scan(&db, &root);

        fs::rename(&saved, &path).unwrap();
        let third = scan(&db, &root);

        assert_eq!(third.stats.added, 1);
        assert_eq!(third.touched_ids, first.touched_ids, "the same row revives");
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
