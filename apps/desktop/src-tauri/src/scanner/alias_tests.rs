//! One row per real file: every scenario where symlinks make a file reachable twice.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use tempfile::{tempdir, TempDir};

use super::{create_scan_row, run_scan, ScanOutcome};
use crate::db::files_repo::{self, FileFilter, FileRow};
use crate::db::roots_repo::{self, Root};
use crate::db::Db;
use crate::scanner::targets::FileKind;

/// Canonical on purpose: a root is stored resolved, and only then can a real path
/// be recognised as lying inside it.
fn base() -> (TempDir, PathBuf) {
    let dir = tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    (dir, base)
}

fn write(path: &Path, contents: &str) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, contents).unwrap();
}

fn link(target: impl AsRef<Path>, at: &Path) {
    fs::create_dir_all(at.parent().unwrap()).unwrap();
    std::os::unix::fs::symlink(target, at).unwrap();
}

fn add_root(db: &Db, path: &Path) -> Root {
    fs::create_dir_all(path).unwrap();
    db.with_conn(|conn| {
        let id = roots_repo::insert(conn, &path.to_string_lossy(), 0)?;
        Ok(roots_repo::get(conn, id)?.expect("inserted root"))
    })
    .unwrap()
}

fn scan(db: &Db, roots: &[&Root]) -> ScanOutcome {
    let roots: Vec<Root> = roots.iter().map(|root| (*root).clone()).collect();
    let scan_id = create_scan_row(db).unwrap();
    run_scan(db, &roots, scan_id, &AtomicBool::new(false), |_| {}).unwrap()
}

fn live(db: &Db) -> Vec<FileRow> {
    db.with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
        .unwrap()
}

fn text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// What a user would see: each row's path, the root it belongs to, its aliases.
fn shape(db: &Db) -> Vec<(String, i64, Vec<String>)> {
    live(db)
        .into_iter()
        .map(|row| (row.path, row.root_id, row.aliases))
        .collect()
}

#[test]
fn a_skill_linked_into_claude_is_one_row_and_vendor_plugins_stay_out() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join("repo/.agents/skills/a/SKILL.md"), "# a");
    link(
        "../../.agents/skills/a",
        &base.join("repo/.claude/skills/a"),
    );
    write(&base.join("repo/skills/b/SKILL.md"), "# b");
    write(
        &base.join("home/.claude/plugins/marketplaces/x/skills/c/SKILL.md"),
        "# c",
    );
    let repo = add_root(&db, &base.join("repo"));
    let home = add_root(&db, &base.join("home"));

    let outcome = scan(&db, &[&repo, &home]);

    assert_eq!(outcome.stats.seen, 2);
    assert_eq!(outcome.stats.added, 2);
    let rows = live(&db);
    assert!(rows.iter().all(|row| row.kind == FileKind::Skill));
    assert_eq!(
        shape(&db),
        [
            (
                text(&base.join("repo/.agents/skills/a/SKILL.md")),
                repo.id,
                vec![text(&base.join("repo/.claude/skills/a/SKILL.md"))]
            ),
            (text(&base.join("repo/skills/b/SKILL.md")), repo.id, vec![]),
        ]
    );
    assert_eq!(rows[0].rel_path, ".agents/skills/a/SKILL.md");
    assert!(!rows[0].is_symlink);
}

#[test]
fn the_real_file_is_the_row_whether_its_alias_sorts_before_or_after_it() {
    for (real_dir, alias_dir) in [("zz", "aa"), ("aa", "zz")] {
        let (_dir, base) = base();
        let db = Db::open_in_memory().unwrap();
        write(&base.join(real_dir).join("skills/s/SKILL.md"), "# s");
        link(
            base.join(real_dir).join("skills/s"),
            &base.join(alias_dir).join("skills/s"),
        );
        let root = add_root(&db, &base);

        scan(&db, &[&root]);

        assert_eq!(
            shape(&db),
            [(
                text(&base.join(real_dir).join("skills/s/SKILL.md")),
                root.id,
                vec![text(&base.join(alias_dir).join("skills/s/SKILL.md"))]
            )],
            "real file under {real_dir}"
        );
    }
}

/// `~/.claude/skills/a -> ~/.agents/skills/a`, each home being its own root.
fn cross_root_tree(base: &Path) {
    write(&base.join(".agents/skills/a/SKILL.md"), "# a");
    link("../../.agents/skills/a", &base.join(".claude/skills/a"));
}

#[test]
fn an_alias_in_one_root_points_at_the_row_in_another_whatever_the_root_order() {
    let (_dir, base) = base();
    cross_root_tree(&base);
    let mut shapes = Vec::new();

    for claude_first in [true, false] {
        let db = Db::open_in_memory().unwrap();
        let claude = add_root(&db, &base.join(".claude"));
        let agents = add_root(&db, &base.join(".agents"));

        let outcome = if claude_first {
            scan(&db, &[&claude, &agents])
        } else {
            scan(&db, &[&agents, &claude])
        };

        assert_eq!(outcome.stats.seen, 1);
        assert_eq!(
            shape(&db),
            [(
                text(&base.join(".agents/skills/a/SKILL.md")),
                agents.id,
                vec![text(&base.join(".claude/skills/a/SKILL.md"))]
            )]
        );
        shapes.push(shape(&db));
    }

    assert_eq!(shapes[0], shapes[1]);
}

#[test]
fn scanning_the_roots_one_at_a_time_ends_in_the_same_index() {
    let (_dir, base) = base();
    cross_root_tree(&base);

    for claude_first in [true, false] {
        let db = Db::open_in_memory().unwrap();
        let claude = add_root(&db, &base.join(".claude"));
        let agents = add_root(&db, &base.join(".agents"));
        let order = if claude_first {
            [&claude, &agents]
        } else {
            [&agents, &claude]
        };

        for root in order {
            scan(&db, &[root]);

            assert_eq!(live(&db).len(), 1, "never a second row for the same file");
        }

        assert_eq!(
            shape(&db),
            [(
                text(&base.join(".agents/skills/a/SKILL.md")),
                agents.id,
                vec![text(&base.join(".claude/skills/a/SKILL.md"))]
            )]
        );
    }
}

#[test]
fn a_real_file_in_a_disabled_root_does_not_carry_the_row() {
    let (_dir, base) = base();
    cross_root_tree(&base);
    let db = Db::open_in_memory().unwrap();
    let claude = add_root(&db, &base.join(".claude"));
    let agents = add_root(&db, &base.join(".agents"));
    db.with_conn(|conn| roots_repo::set_enabled(conn, agents.id, false))
        .unwrap();

    scan(&db, &[&claude]);

    assert_eq!(
        shape(&db),
        [(
            text(&base.join(".claude/skills/a/SKILL.md")),
            claude.id,
            vec![]
        )]
    );
}

#[test]
fn enabling_the_root_of_the_real_file_moves_the_row_there() {
    let (_dir, base) = base();
    cross_root_tree(&base);
    let db = Db::open_in_memory().unwrap();
    let claude = add_root(&db, &base.join(".claude"));
    scan(&db, &[&claude]);

    let agents = add_root(&db, &base.join(".agents"));
    let outcome = scan(&db, &[&claude, &agents]);

    assert_eq!(outcome.stats.added, 1);
    assert_eq!(outcome.stats.removed, 1);
    assert_eq!(
        shape(&db),
        [(
            text(&base.join(".agents/skills/a/SKILL.md")),
            agents.id,
            vec![text(&base.join(".claude/skills/a/SKILL.md"))]
        )]
    );
}

#[test]
fn a_lone_link_to_a_target_outside_the_roots_is_indexed_where_it_is() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join("outside/humanizer/SKILL.md"), "# humanizer");
    write(&base.join("outside/AGENTS.md"), "# shared");
    link(
        base.join("outside/humanizer"),
        &base.join("home/.claude/skills/humanizer"),
    );
    link(
        base.join("outside/AGENTS.md"),
        &base.join("home/project/AGENTS.md"),
    );
    let home = add_root(&db, &base.join("home"));

    scan(&db, &[&home]);

    let rows = live(&db);
    assert_eq!(
        shape(&db),
        [
            (
                text(&base.join("home/.claude/skills/humanizer/SKILL.md")),
                home.id,
                vec![]
            ),
            (text(&base.join("home/project/AGENTS.md")), home.id, vec![]),
        ]
    );
    assert!(
        !rows[0].is_symlink,
        "the directory is the link, not the file"
    );
    assert!(rows[1].is_symlink);
    assert_eq!(
        rows[1].symlink_target.as_deref(),
        Some(text(&base.join("outside/AGENTS.md")).as_str())
    );
}

/// Two roots each linking the same skill that lives outside both.
fn two_links_to_one_outside_target(base: &Path) {
    write(&base.join("outside/s/SKILL.md"), "# s");
    link(base.join("outside/s"), &base.join("a-root/skills/s"));
    link(base.join("outside/s"), &base.join("b-root/skills/s"));
}

#[test]
fn two_links_to_one_outside_target_are_one_row_at_the_smallest_path() {
    let (_dir, base) = base();
    two_links_to_one_outside_target(&base);

    for a_first in [true, false] {
        let db = Db::open_in_memory().unwrap();
        let a = add_root(&db, &base.join("a-root"));
        let b = add_root(&db, &base.join("b-root"));

        if a_first {
            scan(&db, &[&a, &b]);
        } else {
            scan(&db, &[&b, &a]);
        }

        assert_eq!(
            shape(&db),
            [(
                text(&base.join("a-root/skills/s/SKILL.md")),
                a.id,
                vec![text(&base.join("b-root/skills/s/SKILL.md"))]
            )]
        );
    }
}

#[test]
fn a_partial_scan_never_splits_an_outside_target_in_two() {
    let (_dir, base) = base();
    two_links_to_one_outside_target(&base);
    let expected = |a: &Root| {
        vec![(
            text(&base.join("a-root/skills/s/SKILL.md")),
            a.id,
            vec![text(&base.join("b-root/skills/s/SKILL.md"))],
        )]
    };

    let db = Db::open_in_memory().unwrap();
    let a = add_root(&db, &base.join("a-root"));
    let b = add_root(&db, &base.join("b-root"));
    scan(&db, &[&a, &b]);
    scan(&db, &[&b]);
    assert_eq!(shape(&db), expected(&a), "rescanning the alias root alone");

    let db = Db::open_in_memory().unwrap();
    let a = add_root(&db, &base.join("a-root"));
    let b = add_root(&db, &base.join("b-root"));
    scan(&db, &[&b]);
    assert_eq!(live(&db).len(), 1);
    scan(&db, &[&a]);
    assert_eq!(shape(&db), expected(&a), "the smaller path arriving later");
}

#[test]
fn a_file_level_link_inside_the_roots_is_an_alias_not_a_row() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join("AGENTS.md"), "# shared");
    link("AGENTS.md", &base.join("CLAUDE.md"));
    let root = add_root(&db, &base);

    scan(&db, &[&root]);

    let rows = live(&db);
    assert_eq!(
        shape(&db),
        [(
            text(&base.join("AGENTS.md")),
            root.id,
            vec![text(&base.join("CLAUDE.md"))]
        )]
    );
    assert_eq!(rows[0].kind, FileKind::AgentsMd);
    assert!(!rows[0].is_symlink);
}

#[test]
fn a_link_to_a_file_no_walk_would_index_stays_a_row_of_its_own() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join("docs/instructions.md"), "# shared");
    link("docs/instructions.md", &base.join("CLAUDE.md"));
    let root = add_root(&db, &base);

    scan(&db, &[&root]);

    let rows = live(&db);
    assert_eq!(
        shape(&db),
        [(text(&base.join("CLAUDE.md")), root.id, vec![])]
    );
    assert!(rows[0].is_symlink);
}

#[test]
fn an_alias_that_disappears_is_pruned_by_the_next_scan() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join(".agents/skills/a/SKILL.md"), "# a");
    link("../../.agents/skills/a", &base.join(".claude/skills/a"));
    let root = add_root(&db, &base);
    scan(&db, &[&root]);
    let id = live(&db)[0].id;

    fs::remove_file(base.join(".claude/skills/a")).unwrap();
    let outcome = scan(&db, &[&root]);

    assert!(live(&db)[0].aliases.is_empty());
    assert_eq!(outcome.stats.changed, 0);
    assert_eq!(outcome.stats.removed, 0);
    assert_eq!(outcome.touched_ids, [id], "the row is refreshed in the UI");
}

#[test]
fn an_alias_that_appears_is_reported_without_rereading_the_file() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join(".agents/skills/a/SKILL.md"), "# a");
    let root = add_root(&db, &base);
    scan(&db, &[&root]);
    let id = live(&db)[0].id;

    link("../../.agents/skills/a", &base.join(".claude/skills/a"));
    let outcome = scan(&db, &[&root]);
    let settled = scan(&db, &[&root]);

    assert_eq!(outcome.stats.hashed, 0);
    assert_eq!(outcome.touched_ids, [id]);
    assert_eq!(live(&db)[0].aliases.len(), 1);
    assert!(
        settled.touched_ids.is_empty(),
        "a steady tree reports nothing"
    );
}

#[test]
fn removing_the_root_of_an_alias_leaves_no_orphan_behind() {
    let (_dir, base) = base();
    cross_root_tree(&base);
    let db = Db::open_in_memory().unwrap();
    let claude = add_root(&db, &base.join(".claude"));
    let agents = add_root(&db, &base.join(".agents"));
    scan(&db, &[&claude, &agents]);

    db.with_conn(|conn| roots_repo::remove(conn, claude.id))
        .unwrap();

    assert_eq!(
        shape(&db),
        [(
            text(&base.join(".agents/skills/a/SKILL.md")),
            agents.id,
            vec![]
        )]
    );
}

#[test]
fn a_file_is_never_reported_as_a_duplicate_of_its_own_aliases() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join(".agents/skills/a/SKILL.md"), "# same");
    link("../../.agents/skills/a", &base.join(".claude/skills/a"));
    link("../../.agents/skills/a", &base.join(".codex/skills/a"));
    let root = add_root(&db, &base);
    scan(&db, &[&root]);

    assert!(db.with_conn(files_repo::duplicates).unwrap().is_empty());

    write(&base.join("copy/skills/a/SKILL.md"), "# same");
    scan(&db, &[&root]);

    let groups = db.with_conn(files_repo::duplicates).unwrap();
    assert_eq!(groups.len(), 1);
    assert_eq!(
        groups[0]
            .files
            .iter()
            .map(|file| file.path.clone())
            .collect::<Vec<_>>(),
        [
            text(&base.join(".agents/skills/a/SKILL.md")),
            text(&base.join("copy/skills/a/SKILL.md")),
        ],
        "a real copy still is one"
    );
    assert_eq!(groups[0].files[0].aliases.len(), 2);
}

#[test]
fn a_row_indexed_under_an_alias_before_the_upgrade_is_retired_by_the_first_scan() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join(".agents/skills/a/SKILL.md"), "# a");
    link("../../.agents/skills/a", &base.join(".claude/skills/a"));
    let root = add_root(&db, &base);
    let legacy_path = text(&base.join(".claude/skills/a/SKILL.md"));
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO files (root_id, path, rel_path, kind, size, mtime_ns, hash, first_seen_at)
             VALUES (?1, ?2, '.claude/skills/a/SKILL.md', 'skill', 3, 1, 'h', 1)",
            (root.id, &legacy_path),
        )?;
        Ok(())
    })
    .unwrap();

    let outcome = scan(&db, &[&root]);

    assert_eq!(outcome.stats.added, 1);
    assert_eq!(outcome.stats.removed, 1);
    assert_eq!(
        shape(&db),
        [(
            text(&base.join(".agents/skills/a/SKILL.md")),
            root.id,
            vec![legacy_path]
        )]
    );
}

#[test]
fn a_link_that_turns_into_a_real_copy_becomes_a_row_again() {
    let (_dir, base) = base();
    let db = Db::open_in_memory().unwrap();
    write(&base.join("AGENTS.md"), "# shared");
    link("AGENTS.md", &base.join("CLAUDE.md"));
    let root = add_root(&db, &base);
    scan(&db, &[&root]);

    fs::remove_file(base.join("CLAUDE.md")).unwrap();
    write(&base.join("CLAUDE.md"), "# own");
    scan(&db, &[&root]);

    assert_eq!(
        shape(&db),
        [
            (text(&base.join("AGENTS.md")), root.id, vec![]),
            (text(&base.join("CLAUDE.md")), root.id, vec![]),
        ]
    );
}
