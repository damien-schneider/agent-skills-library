use std::collections::{BTreeSet, HashMap, HashSet};

use rusqlite::Connection;
use serde::Serialize;

use crate::db::files_repo::{self, FileFilter, FileRow};
use crate::error::AppResult;

struct LinkEdge {
    from: i64,
    to: i64,
}

struct LinkGraph {
    nodes: Vec<FileRow>,
    edges: Vec<LinkEdge>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileLinks {
    pub outgoing: Vec<FileRow>,
    pub incoming: Vec<FileRow>,
}

/// Stamping `refs_hash` here is what makes `refs_hash == hash` mean "references are current",
/// so a scan re-reads exactly the files that still owe theirs.
pub fn replace_refs(
    conn: &Connection,
    file_id: i64,
    hash: &str,
    names: &BTreeSet<String>,
) -> AppResult<()> {
    conn.execute("DELETE FROM file_refs WHERE file_id = ?1", [file_id])?;
    let mut stmt = conn.prepare("INSERT INTO file_refs (file_id, name) VALUES (?1, ?2)")?;
    for name in names {
        stmt.execute(rusqlite::params![file_id, name])?;
    }
    drop(stmt);
    conn.execute(
        "UPDATE files SET refs_hash = ?2 WHERE id = ?1",
        rusqlite::params![file_id, hash],
    )?;
    Ok(())
}

fn load_refs(conn: &Connection) -> AppResult<Vec<(i64, String)>> {
    let mut stmt = conn.prepare(
        "SELECT file_refs.file_id, file_refs.name FROM file_refs
         JOIN files ON files.id = file_refs.file_id
         WHERE files.deleted_at IS NULL",
    )?;
    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// A name can be installed in several places; the closest copy wins, and a
/// genuinely ambiguous name links to every candidate rather than guessing.
fn nearest<'a>(candidates: &'a [&'a FileRow], from: &FileRow) -> Vec<&'a FileRow> {
    let same_project: Vec<&FileRow> = candidates
        .iter()
        .filter(|candidate| {
            candidate.project_dir.is_some() && candidate.project_dir == from.project_dir
        })
        .copied()
        .collect();
    if !same_project.is_empty() {
        return same_project;
    }

    let same_root: Vec<&FileRow> = candidates
        .iter()
        .filter(|candidate| candidate.root_id == from.root_id)
        .copied()
        .collect();
    if !same_root.is_empty() {
        return same_root;
    }

    candidates.to_vec()
}

/// The same skill checked out in several worktrees is one skill: identical bytes collapse
/// to the shortest path rather than showing the reader three copies of the same link.
fn dedupe_by_content(candidates: Vec<&FileRow>) -> Vec<&FileRow> {
    let mut sorted = candidates;
    sorted.sort_by(|a, b| a.path.len().cmp(&b.path.len()).then(a.path.cmp(&b.path)));

    let mut seen: HashSet<&str> = HashSet::new();
    sorted
        .into_iter()
        .filter(|candidate| seen.insert(candidate.hash.as_str()))
        .collect()
}

fn graph(conn: &Connection) -> AppResult<LinkGraph> {
    let nodes = files_repo::list(conn, &FileFilter::default())?;

    let mut by_id: HashMap<i64, &FileRow> = HashMap::with_capacity(nodes.len());
    let mut by_name: HashMap<&str, Vec<&FileRow>> = HashMap::new();
    for node in &nodes {
        by_id.insert(node.id, node);
        if let Some(name) = &node.name {
            by_name.entry(name.as_str()).or_default().push(node);
        }
    }

    let mut edges = Vec::new();
    for (from_id, name) in load_refs(conn)? {
        let (Some(from), Some(candidates)) = (by_id.get(&from_id), by_name.get(name.as_str()))
        else {
            continue;
        };
        for target in dedupe_by_content(nearest(candidates, from)) {
            if target.id != from_id {
                edges.push(LinkEdge {
                    from: from_id,
                    to: target.id,
                });
            }
        }
    }

    Ok(LinkGraph { nodes, edges })
}

pub fn links_of(conn: &Connection, file_id: i64) -> AppResult<FileLinks> {
    let LinkGraph { nodes, edges } = graph(conn)?;
    let by_id: HashMap<i64, &FileRow> = nodes.iter().map(|node| (node.id, node)).collect();
    let pick = |id: i64| by_id.get(&id).map(|row| (*row).clone());

    Ok(FileLinks {
        outgoing: edges
            .iter()
            .filter(|edge| edge.from == file_id)
            .filter_map(|edge| pick(edge.to))
            .collect(),
        incoming: edges
            .iter()
            .filter(|edge| edge.to == file_id)
            .filter_map(|edge| pick(edge.from))
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::FileRecord;
    use crate::db::{roots_repo, Db};
    use crate::scanner::targets::FileKind;

    fn insert(db: &Db, root_id: i64, path: &str, kind: FileKind, name: Option<&str>) -> i64 {
        let record = FileRecord {
            root_id,
            path: path.to_string(),
            rel_path: path.to_string(),
            kind,
            name: name.map(str::to_string),
            project_dir: None,
            size: 0,
            mtime_ns: 0,
            hash: format!("hash:{path}"),
            is_symlink: false,
            symlink_target: None,
        };
        db.with_conn(|conn| files_repo::upsert(conn, &record, 1, 0))
            .unwrap()
    }

    fn insert_copy(db: &Db, root_id: i64, path: &str, name: &str, hash: &str) -> i64 {
        let record = FileRecord {
            root_id,
            path: path.to_string(),
            rel_path: path.to_string(),
            kind: FileKind::ClaudeSkill,
            name: Some(name.to_string()),
            project_dir: None,
            size: 0,
            mtime_ns: 0,
            hash: hash.to_string(),
            is_symlink: false,
            symlink_target: None,
        };
        db.with_conn(|conn| files_repo::upsert(conn, &record, 1, 0))
            .unwrap()
    }

    fn refs(db: &Db, file_id: i64, names: &[&str]) {
        let set: BTreeSet<String> = names.iter().map(|name| (*name).to_string()).collect();
        db.with_conn(|conn| replace_refs(conn, file_id, "hash", &set))
            .unwrap();
    }

    fn setup() -> (Db, i64) {
        let db = Db::open_in_memory().unwrap();
        let root_id = db
            .with_conn(|conn| roots_repo::insert(conn, "/root", 0))
            .unwrap();
        (db, root_id)
    }

    #[test]
    fn links_a_mention_to_the_file_that_owns_the_name() {
        let (db, root) = setup();
        let claude = insert(&db, root, "/root/CLAUDE.md", FileKind::ClaudeMd, None);
        let skill = insert(
            &db,
            root,
            "/root/.claude/skills/react-doctor/SKILL.md",
            FileKind::ClaudeSkill,
            Some("react-doctor"),
        );
        refs(&db, claude, &["react-doctor", "not-a-skill"]);

        let links = db.with_conn(|conn| links_of(conn, skill)).unwrap();

        assert_eq!(links.incoming.len(), 1);
        assert_eq!(links.incoming[0].id, claude);
        assert!(links.outgoing.is_empty());
    }

    #[test]
    fn a_file_never_links_to_itself() {
        let (db, root) = setup();
        let skill = insert(
            &db,
            root,
            "/root/.claude/skills/upgrade/SKILL.md",
            FileKind::ClaudeSkill,
            Some("upgrade"),
        );
        refs(&db, skill, &["upgrade"]);

        assert!(db.with_conn(graph).unwrap().edges.is_empty());
    }

    #[test]
    fn a_name_installed_twice_resolves_to_the_copy_in_the_same_root() {
        let (db, root) = setup();
        let other_root = db
            .with_conn(|conn| roots_repo::insert(conn, "/other", 0))
            .unwrap();
        let claude = insert(&db, root, "/root/CLAUDE.md", FileKind::ClaudeMd, None);
        let near = insert(
            &db,
            root,
            "/root/.claude/skills/humanizer/SKILL.md",
            FileKind::ClaudeSkill,
            Some("humanizer"),
        );
        insert(
            &db,
            other_root,
            "/other/.claude/skills/humanizer/SKILL.md",
            FileKind::ClaudeSkill,
            Some("humanizer"),
        );
        refs(&db, claude, &["humanizer"]);

        let links = db.with_conn(|conn| links_of(conn, claude)).unwrap();

        assert_eq!(
            links.outgoing.iter().map(|row| row.id).collect::<Vec<_>>(),
            [near]
        );
    }

    #[test]
    fn a_deleted_target_drops_out_of_the_graph() {
        let (db, root) = setup();
        let claude = insert(&db, root, "/root/CLAUDE.md", FileKind::ClaudeMd, None);
        insert(
            &db,
            root,
            "/root/.claude/skills/humanizer/SKILL.md",
            FileKind::ClaudeSkill,
            Some("humanizer"),
        );
        refs(&db, claude, &["humanizer"]);

        db.with_conn(|conn| {
            files_repo::mark_deleted_by_path(conn, "/root/.claude/skills/humanizer/SKILL.md", 1)
        })
        .unwrap();

        assert!(db
            .with_conn(|conn| links_of(conn, claude))
            .unwrap()
            .outgoing
            .is_empty());
    }

    #[test]
    fn the_same_skill_copied_across_worktrees_links_once() {
        let (db, root) = setup();
        let claude = insert(&db, root, "/root/CLAUDE.md", FileKind::ClaudeMd, None);
        let canonical = insert_copy(
            &db,
            root,
            "/root/worktrees/a/.claude/skills/react-best-practices/SKILL.md",
            "react-best-practices",
            "same",
        );
        insert_copy(
            &db,
            root,
            "/root/worktrees/bb/.claude/skills/react-best-practices/SKILL.md",
            "react-best-practices",
            "same",
        );
        let edited = insert_copy(
            &db,
            root,
            "/root/worktrees/cc/.claude/skills/react-best-practices/SKILL.md",
            "react-best-practices",
            "diverged",
        );
        refs(&db, claude, &["react-best-practices"]);

        let outgoing = db
            .with_conn(|conn| links_of(conn, claude))
            .unwrap()
            .outgoing;

        assert_eq!(
            outgoing.iter().map(|file| file.id).collect::<Vec<_>>(),
            vec![canonical, edited],
            "identical copies collapse, a diverged one stays its own link"
        );
    }
}
