use std::path::Path;

use rusqlite::Connection;

use crate::db::aliases_repo::{self, AliasRecord};
use crate::db::files_repo::{self, FileRecord};
use crate::db::links_repo;
use crate::db::roots_repo::Root;
use crate::error::AppResult;

use super::refs::{self, Content};
use super::walk::{project_dir_of, WalkEntry};

/// One real file ready for the index: its row, what was read from it, its other paths.
pub struct Indexable {
    pub record: FileRecord,
    /// `None` when the file was untouched: what was derived from it is already stored.
    pub content: Option<Content>,
    pub aliases: Vec<AliasRecord>,
}

pub struct Stored {
    pub id: i64,
    pub aliases_changed: bool,
    /// Rows that were indexed for the same bytes under another path and stepped aside.
    pub retired: Vec<i64>,
    /// Other files whose alias list moved.
    pub relinked: Vec<i64>,
}

pub fn record_for(entry: &WalkEntry, root: &Root, hash: String) -> FileRecord {
    let root_path = Path::new(&root.path);
    FileRecord {
        root_id: root.id,
        path: entry.path.to_string_lossy().into_owned(),
        real_path: entry.real_path.to_string_lossy().into_owned(),
        rel_path: entry
            .path
            .strip_prefix(root_path)
            .unwrap_or(&entry.path)
            .to_string_lossy()
            .into_owned(),
        kind: entry.kind,
        name: refs::name_for(&entry.path, entry.kind),
        project_dir: project_dir_of(&entry.path, root_path),
        size: entry.size,
        mtime_ns: entry.mtime_ns,
        hash,
        is_symlink: entry.is_symlink,
        symlink_target: entry.symlink_target.clone(),
    }
}

/// References and description are stamped with the hash they were read from, which
/// is how a scan knows it may skip the read next time.
pub fn store_content(conn: &Connection, id: i64, hash: &str, content: &Content) -> AppResult<()> {
    links_repo::replace_refs(conn, id, hash, &content.refs)?;
    files_repo::set_description(conn, id, hash, content.description.as_deref())
}

/// The single write path of the index, shared by scans and by the watcher so both
/// keep the same invariant: one live row per real file, and no path that is at
/// once a row and an alias.
pub fn store(conn: &Connection, item: &Indexable, scan_id: i64, now_ms: i64) -> AppResult<Stored> {
    let record = &item.record;
    let id = files_repo::upsert(conn, record, scan_id, now_ms)?;
    if let Some(content) = &item.content {
        store_content(conn, id, &record.hash, content)?;
    }

    let mut retired = files_repo::retire_twins(conn, id, &record.real_path, now_ms)?;
    let relinked: Vec<i64> = aliases_repo::forget(conn, &record.path)?
        .into_iter()
        .filter(|owner| *owner != id)
        .collect();

    let mut aliases_changed = false;
    for alias in &item.aliases {
        retired.extend(files_repo::mark_deleted_by_path(conn, &alias.path, now_ms)?);
        aliases_changed |= aliases_repo::record(conn, id, alias, scan_id)?;
    }

    Ok(Stored {
        id,
        aliases_changed,
        retired,
        relinked,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::FileFilter;
    use crate::db::{roots_repo, Db};
    use crate::scanner::targets::FileKind;

    const REAL: &str = "/repo/.agents/skills/a/SKILL.md";
    const ALIAS: &str = "/repo/.claude/skills/a/SKILL.md";

    fn record(root_id: i64, path: &str, real_path: &str) -> FileRecord {
        FileRecord {
            root_id,
            path: path.to_string(),
            real_path: real_path.to_string(),
            rel_path: path.trim_start_matches("/repo/").to_string(),
            kind: FileKind::Skill,
            name: Some("a".to_string()),
            project_dir: None,
            size: 1,
            mtime_ns: 1,
            hash: "h".to_string(),
            is_symlink: false,
            symlink_target: None,
        }
    }

    fn item(root_id: i64, path: &str, aliases: &[&str]) -> Indexable {
        Indexable {
            record: record(root_id, path, REAL),
            content: Some(Content {
                refs: ["agent-browser".to_string()].into(),
                description: Some("Use for reviews".to_string()),
            }),
            aliases: aliases
                .iter()
                .map(|alias| AliasRecord {
                    path: (*alias).to_string(),
                    root_id,
                })
                .collect(),
        }
    }

    fn seeded() -> (Db, i64) {
        let db = Db::open_in_memory().unwrap();
        let root_id = db
            .with_conn(|conn| roots_repo::insert(conn, "/repo", 0))
            .unwrap();
        (db, root_id)
    }

    fn live(db: &Db) -> Vec<files_repo::FileRow> {
        db.with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
            .unwrap()
    }

    #[test]
    fn stores_the_row_what_was_read_from_it_and_its_aliases() {
        let (db, root_id) = seeded();

        let stored = db
            .with_conn(|conn| store(conn, &item(root_id, REAL, &[ALIAS]), 1, 0))
            .unwrap();

        let rows = live(&db);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, stored.id);
        assert_eq!(rows[0].description.as_deref(), Some("Use for reviews"));
        assert_eq!(rows[0].aliases, [ALIAS]);
        assert!(stored.aliases_changed);
        let indexed = db.with_conn(files_repo::indexed_by_path).unwrap();
        assert!(indexed[REAL].is_fully_read());
    }

    #[test]
    fn storing_again_reports_no_alias_change() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| store(conn, &item(root_id, REAL, &[ALIAS]), 1, 0))
            .unwrap();

        let again = db
            .with_conn(|conn| store(conn, &item(root_id, REAL, &[ALIAS]), 2, 0))
            .unwrap();

        assert!(!again.aliases_changed);
        assert!(again.retired.is_empty());
        assert!(again.relinked.is_empty());
    }

    #[test]
    fn a_row_indexed_under_what_is_now_an_alias_steps_aside() {
        let (db, root_id) = seeded();
        let legacy = db
            .with_conn(|conn| files_repo::upsert(conn, &record(root_id, ALIAS, ALIAS), 1, 0))
            .unwrap();

        let stored = db
            .with_conn(|conn| store(conn, &item(root_id, REAL, &[ALIAS]), 2, 0))
            .unwrap();

        assert_eq!(stored.retired, [legacy]);
        let rows = live(&db);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].path, REAL);
    }

    #[test]
    fn another_live_row_for_the_same_real_file_steps_aside() {
        let (db, root_id) = seeded();
        let previous = db
            .with_conn(|conn| store(conn, &item(root_id, "/repo/z/a/SKILL.md", &[]), 1, 0))
            .unwrap();

        let stored = db
            .with_conn(|conn| {
                store(
                    conn,
                    &item(root_id, "/repo/b/a/SKILL.md", &["/repo/z/a/SKILL.md"]),
                    2,
                    0,
                )
            })
            .unwrap();

        assert_eq!(stored.retired, [previous.id]);
        let rows = live(&db);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].path, "/repo/b/a/SKILL.md");
        assert_eq!(rows[0].aliases, ["/repo/z/a/SKILL.md"]);
    }

    #[test]
    fn a_path_that_becomes_a_row_stops_being_an_alias() {
        let (db, root_id) = seeded();
        let owner = db
            .with_conn(|conn| store(conn, &item(root_id, REAL, &[ALIAS]), 1, 0))
            .unwrap();
        let mut standalone = item(root_id, ALIAS, &[]);
        standalone.record.real_path = ALIAS.to_string();

        let stored = db.with_conn(|conn| store(conn, &standalone, 2, 0)).unwrap();

        assert_eq!(stored.relinked, [owner.id]);
        let rows = live(&db);
        assert_eq!(rows.len(), 2);
        assert!(rows.iter().all(|row| row.aliases.is_empty()));
    }

    #[test]
    fn an_untouched_file_keeps_what_was_read_from_it() {
        let (db, root_id) = seeded();
        db.with_conn(|conn| store(conn, &item(root_id, REAL, &[]), 1, 0))
            .unwrap();
        let mut untouched = item(root_id, REAL, &[]);
        untouched.content = None;

        db.with_conn(|conn| store(conn, &untouched, 2, 0)).unwrap();

        assert_eq!(live(&db)[0].description.as_deref(), Some("Use for reviews"));
    }
}
