use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::db::roots_repo::{self, Root};
use crate::db::{aliases_repo, files_repo, now_ms, Db};
use crate::error::{AppError, AppResult};
use crate::paths::{canonicalize, ensure_within_roots};
use crate::scanner::targets::FileKind;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashResult {
    /// What went to the Trash: a skill's whole directory, the lone file otherwise.
    pub trashed: String,
    /// Symlinks that pointed into it and were removed so nothing is left dangling.
    pub removed_links: Vec<String>,
}

#[derive(Debug)]
pub struct Trashed {
    pub result: TrashResult,
    pub file_ids: Vec<i64>,
}

/// `NSFileManager` only: the Finder route needs the macOS Automation permission, and
/// deleting a file must never prompt for access. The cost is Finder's "Put Back".
#[cfg(target_os = "macos")]
pub fn move_to_os_trash(path: &Path) -> AppResult<()> {
    use ::trash::macos::{DeleteMethod, TrashContextExtMacos as _};

    let mut context = ::trash::TrashContext::new();
    context.set_delete_method(DeleteMethod::NsFileManager);
    context
        .delete(path)
        .map_err(|error| trash_failed(path, &error))
}

#[cfg(not(target_os = "macos"))]
pub fn move_to_os_trash(path: &Path) -> AppResult<()> {
    ::trash::delete(path).map_err(|error| trash_failed(path, &error))
}

fn trash_failed(path: &Path, error: &::trash::Error) -> AppError {
    AppError::internal(format!(
        "moving {} to the Trash failed: {error}",
        path.display()
    ))
}

/// A skill is its directory — references, scripts and all. The one exception is a
/// SKILL.md sitting directly in a root: trashing its parent would trash the root.
fn item_of(kind: FileKind, file: &Path, roots: &[Root]) -> PathBuf {
    let directory = match kind {
        FileKind::Skill => file.parent(),
        _ => None,
    };
    directory
        .filter(|directory| {
            roots
                .iter()
                .all(|root| !Path::new(&root.path).starts_with(directory))
        })
        .unwrap_or(file)
        .to_path_buf()
}

/// The symlink through which `path` reaches into `item`: the path itself or the
/// nearest linked ancestor. A link to something that merely contains `item`
/// (`~/.claude/skills -> ~/.agents/skills`) is not ours to remove.
fn link_into(path: &Path, item: &Path) -> Option<PathBuf> {
    path.ancestors()
        .find(|candidate| is_symlink(candidate))
        .filter(|link| {
            link.canonicalize()
                .is_ok_and(|resolved| resolved.starts_with(item))
        })
        .map(Path::to_path_buf)
}

fn is_symlink(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|metadata| metadata.is_symlink())
}

/// Every indexed file living in `item`, and the links leading into it.
fn affected(db: &Db, item: &Path) -> AppResult<(Vec<i64>, BTreeSet<PathBuf>)> {
    db.with_conn(|conn| {
        let file_ids = files_repo::live_ids_at_or_under(conn, &item.to_string_lossy())?;
        let mut links = BTreeSet::new();
        for id in &file_ids {
            let row = files_repo::require(conn, *id)?;
            // the row's own path counts: it is a link when the real file could not carry the row
            for path in std::iter::once(&row.path).chain(&row.aliases) {
                links.extend(link_into(Path::new(path), item));
            }
        }
        Ok((file_ids, links))
    })
}

/// Moves an indexed file to the OS trash through `move_to_trash`. The links are
/// identified while they still resolve but removed only once the item is in the
/// Trash, so a refused or failed move leaves the disk exactly as it was.
pub fn trash_indexed(
    db: &Db,
    file_id: i64,
    move_to_trash: impl FnOnce(&Path) -> AppResult<()>,
) -> AppResult<Trashed> {
    let (row, roots) = db.with_conn(|conn| {
        Ok((
            files_repo::require(conn, file_id)?,
            roots_repo::list_enabled(conn)?,
        ))
    })?;
    // the real location decides: a link inside a root must not reach out and delete
    let file = canonicalize(Path::new(&row.path))?;
    ensure_within_roots(&file, &roots)?;
    let item = item_of(row.kind, &file, &roots);

    let (file_ids, links) = affected(db, &item)?;
    move_to_trash(&item)?;

    let mut removed_links = Vec::with_capacity(links.len());
    for link in links {
        // checked again: only ever a symlink is unlinked, never a real directory
        if is_symlink(&link) && std::fs::remove_file(&link).is_ok() {
            removed_links.push(link.to_string_lossy().into_owned());
        }
    }

    db.with_tx(|tx| {
        let now = now_ms();
        for id in &file_ids {
            files_repo::mark_deleted(tx, *id, now)?;
            aliases_repo::take_of(tx, *id)?;
        }
        Ok(())
    })?;

    Ok(Trashed {
        result: TrashResult {
            trashed: item.to_string_lossy().into_owned(),
            removed_links,
        },
        file_ids,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::{FileFilter, FileRow};
    use crate::scanner::{create_scan_row, run_scan};
    use std::cell::RefCell;
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use tempfile::{tempdir, TempDir};

    struct Fixture {
        db: Db,
        _dir: TempDir,
        base: PathBuf,
        /// Stands in for the OS trash: a folder outside every root.
        bin: PathBuf,
    }

    impl Fixture {
        fn new(roots: &[&str]) -> Self {
            let dir = tempdir().unwrap();
            let base = dir.path().canonicalize().unwrap();
            let db = Db::open_in_memory().unwrap();
            for root in roots {
                let path = base.join(root);
                fs::create_dir_all(&path).unwrap();
                db.with_conn(|conn| roots_repo::insert(conn, &path.to_string_lossy(), 0))
                    .unwrap();
            }
            let bin = base.join("bin");
            fs::create_dir_all(&bin).unwrap();
            Self {
                db,
                _dir: dir,
                base,
                bin,
            }
        }

        fn scan(&self) {
            let roots = self.db.with_conn(roots_repo::list_enabled).unwrap();
            let scan_id = create_scan_row(&self.db).unwrap();
            run_scan(&self.db, &roots, scan_id, &AtomicBool::new(false), |_| {}).unwrap();
        }

        fn live(&self) -> Vec<FileRow> {
            self.db
                .with_conn(|conn| files_repo::list(conn, &FileFilter::default()))
                .unwrap()
        }

        fn id_of(&self, suffix: &str) -> i64 {
            self.live()
                .iter()
                .find(|row| row.path.ends_with(suffix))
                .expect("indexed file")
                .id
        }

        fn trash(&self, file_id: i64) -> AppResult<Trashed> {
            trash_indexed(&self.db, file_id, |item| {
                let name = item.file_name().expect("named item");
                Ok(fs::rename(item, self.bin.join(name))?)
            })
        }
    }

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn link(target: impl AsRef<Path>, at: &Path) {
        fs::create_dir_all(at.parent().unwrap()).unwrap();
        std::os::unix::fs::symlink(target, at).unwrap();
    }

    fn text(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn trashes_the_whole_skill_directory_and_the_links_into_it() {
        let fx = Fixture::new(&["repo", "home"]);
        let skill = fx.base.join("repo/.agents/skills/a");
        write(&skill.join("SKILL.md"), "# a");
        write(&skill.join("references/notes.md"), "notes");
        let claude_link = fx.base.join("repo/.claude/skills/a");
        let home_link = fx.base.join("home/.claude/skills/a");
        link("../../.agents/skills/a", &claude_link);
        link(&skill, &home_link);
        write(&fx.base.join("repo/skills/kept/SKILL.md"), "# kept");
        fx.scan();
        let id = fx.id_of(".agents/skills/a/SKILL.md");

        let trashed = fx.trash(id).unwrap();

        assert_eq!(trashed.result.trashed, text(&skill));
        assert_eq!(
            trashed.result.removed_links,
            [text(&home_link), text(&claude_link)]
        );
        assert_eq!(trashed.file_ids, [id]);
        assert!(!skill.exists());
        assert!(fx.bin.join("a/references/notes.md").is_file());
        assert!(fs::symlink_metadata(&claude_link).is_err());
        assert!(fs::symlink_metadata(&home_link).is_err());
        assert!(fx.base.join("repo/.claude/skills").is_dir());
        let live = fx.live();
        assert_eq!(live.len(), 1, "the row is retired");
        assert!(live[0].path.ends_with("skills/kept/SKILL.md"));
        fx.scan();
        assert_eq!(fx.live().len(), 1, "and a scan agrees with the index");
    }

    #[test]
    fn trashes_just_the_file_for_any_other_kind() {
        let fx = Fixture::new(&["repo"]);
        let agents = fx.base.join("repo/AGENTS.md");
        let claude = fx.base.join("repo/CLAUDE.md");
        write(&agents, "# shared");
        link("AGENTS.md", &claude);
        write(&fx.base.join("repo/README.md"), "kept");
        fx.scan();
        let id = fx.id_of("AGENTS.md");

        let trashed = fx.trash(id).unwrap();

        assert_eq!(trashed.result.trashed, text(&agents));
        assert_eq!(trashed.result.removed_links, [text(&claude)]);
        assert!(fx.bin.join("AGENTS.md").is_file());
        assert!(fs::symlink_metadata(&claude).is_err());
        assert!(fx.base.join("repo/README.md").is_file());
        assert!(fx.live().is_empty());
    }

    #[test]
    fn every_indexed_file_inside_a_trashed_skill_is_retired() {
        let fx = Fixture::new(&["repo"]);
        let skill = fx.base.join("repo/skills/a");
        write(&skill.join("SKILL.md"), "# a");
        write(&skill.join("AGENTS.md"), "# nested");
        fx.scan();
        let skill_id = fx.id_of("skills/a/SKILL.md");
        let nested_id = fx.id_of("skills/a/AGENTS.md");

        let trashed = fx.trash(skill_id).unwrap();

        let mut expected = vec![skill_id, nested_id];
        expected.sort_unstable();
        assert_eq!(trashed.file_ids, expected);
        assert!(fx.live().is_empty());
    }

    #[test]
    fn refuses_a_file_whose_real_location_is_outside_the_roots() {
        let fx = Fixture::new(&["home"]);
        let outside = fx.base.join("outside/humanizer");
        write(&outside.join("SKILL.md"), "# humanizer");
        let alias = fx.base.join("home/.claude/skills/humanizer");
        link(&outside, &alias);
        fx.scan();
        let id = fx.id_of("home/.claude/skills/humanizer/SKILL.md");

        let error = fx.trash(id).unwrap_err();

        assert_eq!(error.code(), "outside_roots");
        assert!(outside.join("SKILL.md").is_file());
        assert!(fs::symlink_metadata(&alias).unwrap().is_symlink());
        assert_eq!(fx.live().len(), 1);
    }

    #[test]
    fn refuses_a_file_whose_root_was_disabled() {
        let fx = Fixture::new(&["repo"]);
        write(&fx.base.join("repo/CLAUDE.md"), "# claude");
        fx.scan();
        let id = fx.id_of("CLAUDE.md");
        fx.db
            .with_conn(|conn| {
                let root = roots_repo::list(conn)?.remove(0);
                roots_repo::set_enabled(conn, root.id, false)
            })
            .unwrap();

        let error = fx.trash(id).unwrap_err();

        assert_eq!(error.code(), "outside_roots");
        assert!(fx.base.join("repo/CLAUDE.md").is_file());
    }

    #[test]
    fn a_failed_move_leaves_links_and_index_untouched() {
        let fx = Fixture::new(&["repo"]);
        let skill = fx.base.join("repo/.agents/skills/a");
        write(&skill.join("SKILL.md"), "# a");
        let alias = fx.base.join("repo/.claude/skills/a");
        link("../../.agents/skills/a", &alias);
        fx.scan();
        let id = fx.id_of(".agents/skills/a/SKILL.md");

        let result = trash_indexed(&fx.db, id, |_| Err(AppError::internal("finder said no")));

        assert_eq!(result.unwrap_err().code(), "internal");
        assert!(skill.join("SKILL.md").is_file());
        assert!(fs::symlink_metadata(&alias).unwrap().is_symlink());
        assert_eq!(fx.live()[0].aliases.len(), 1);
    }

    #[test]
    fn a_link_to_a_directory_that_only_contains_the_skill_is_kept() {
        let fx = Fixture::new(&["home"]);
        let skill = fx.base.join("home/.agents/skills/a");
        write(&skill.join("SKILL.md"), "# a");
        write(&fx.base.join("home/.agents/skills/b/SKILL.md"), "# b");
        let whole = fx.base.join("home/.claude/skills");
        link("../.agents/skills", &whole);
        fx.scan();
        let id = fx.id_of(".agents/skills/a/SKILL.md");

        let trashed = fx.trash(id).unwrap();

        assert!(trashed.result.removed_links.is_empty());
        assert!(fs::symlink_metadata(&whole).unwrap().is_symlink());
        assert!(whole.join("b/SKILL.md").is_file());
    }

    #[test]
    fn a_skill_file_sitting_in_a_root_never_takes_the_root_with_it() {
        let fx = Fixture::new(&["repo"]);
        write(&fx.base.join("repo/SKILL.md"), "# root skill");
        write(&fx.base.join("repo/README.md"), "kept");
        fx.scan();
        let id = fx.id_of("repo/SKILL.md");

        let trashed = fx.trash(id).unwrap();

        assert_eq!(trashed.result.trashed, text(&fx.base.join("repo/SKILL.md")));
        assert!(fx.base.join("repo/README.md").is_file());
    }

    #[test]
    fn a_link_carrying_the_row_goes_with_the_file_it_points_at() {
        let fx = Fixture::new(&["repo"]);
        let real = fx.base.join("repo/docs/instructions.md");
        let claude = fx.base.join("repo/CLAUDE.md");
        write(&real, "# shared");
        link("docs/instructions.md", &claude);
        fx.scan();
        let id = fx.id_of("CLAUDE.md");

        let trashed = fx.trash(id).unwrap();

        assert_eq!(trashed.result.trashed, text(&real));
        assert_eq!(trashed.result.removed_links, [text(&claude)]);
        assert!(fx.live().is_empty());
    }

    #[test]
    fn reports_an_unknown_file() {
        let fx = Fixture::new(&["repo"]);
        let moved = RefCell::new(false);

        let result = trash_indexed(&fx.db, 404, |_| {
            *moved.borrow_mut() = true;
            Ok(())
        });

        assert_eq!(result.unwrap_err().code(), "not_found");
        assert!(!*moved.borrow());
    }

    #[test]
    fn serializes_camel_case_over_ipc() {
        let json = serde_json::to_value(TrashResult {
            trashed: "/repo/skills/a".to_string(),
            removed_links: vec!["/home/.claude/skills/a".to_string()],
        })
        .unwrap();

        assert_eq!(json["trashed"], "/repo/skills/a");
        assert_eq!(json["removedLinks"][0], "/home/.claude/skills/a");
    }
}
