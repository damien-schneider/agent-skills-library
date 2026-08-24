use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::UNIX_EPOCH;

use ignore::{WalkBuilder, WalkState};

use super::targets::{classify, is_skipped_dir, FileKind};

/// Scans stay background work: never take more than half a laptop's cores.
const MAX_THREADS: usize = 4;

#[derive(Debug, Clone)]
pub struct WalkEntry {
    pub path: PathBuf,
    pub kind: FileKind,
    pub size: i64,
    pub mtime_ns: i64,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
}

fn mtime_ns(metadata: &std::fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_nanos() as i64)
        .unwrap_or_default()
}

/// `path` is the walked entry; content stats come from the resolved target so a
/// symlinked CLAUDE.md is indexed by what it actually contains.
fn describe(path: &Path, kind: FileKind) -> Option<WalkEntry> {
    let link_metadata = std::fs::symlink_metadata(path).ok()?;
    let is_symlink = link_metadata.is_symlink();
    let metadata = if is_symlink {
        std::fs::metadata(path).ok()?
    } else {
        link_metadata
    };
    if !metadata.is_file() {
        return None;
    }

    let symlink_target = is_symlink
        .then(|| std::fs::read_link(path).ok())
        .flatten()
        .map(|target| target.to_string_lossy().into_owned());

    Some(WalkEntry {
        path: path.to_path_buf(),
        kind,
        size: metadata.len() as i64,
        mtime_ns: mtime_ns(&metadata),
        is_symlink,
        symlink_target,
    })
}

fn is_skipped(entry: &ignore::DirEntry) -> bool {
    entry
        .file_type()
        .is_some_and(|file_type| file_type.is_dir())
        && entry.file_name().to_str().is_some_and(is_skipped_dir)
}

pub fn walk_root(root: &Path, cancel: &AtomicBool, on_entry: impl Fn(WalkEntry) + Send + Sync) {
    let threads = std::thread::available_parallelism()
        .map(|value| value.get().saturating_sub(2).clamp(1, MAX_THREADS))
        .unwrap_or(1);

    WalkBuilder::new(root)
        // not gitignore-driven on purpose: `.claude/` is commonly ignored yet must be indexed
        .standard_filters(false)
        .hidden(false)
        // skills are routinely symlinked into `~/.claude/skills`; the walker sees what the agent sees
        .follow_links(true)
        .threads(threads)
        .filter_entry(|entry| !is_skipped(entry))
        .build_parallel()
        .run(|| {
            Box::new(|result| {
                if cancel.load(Ordering::Relaxed) {
                    return WalkState::Quit;
                }
                let Ok(entry) = result else {
                    return WalkState::Continue;
                };
                if entry
                    .file_type()
                    .is_some_and(|file_type| file_type.is_dir())
                {
                    return WalkState::Continue;
                }
                if let Some(kind) = classify(entry.path()) {
                    if let Some(walk_entry) = describe(entry.path(), kind) {
                        on_entry(walk_entry);
                    }
                }
                WalkState::Continue
            })
        });
}

/// Nearest ancestor holding a `.git` entry; None for user-scope roots like `~/.claude`.
pub fn project_dir_of(path: &Path, root: &Path) -> Option<String> {
    let mut current = path.parent();
    while let Some(dir) = current {
        if dir.join(".git").exists() {
            return Some(dir.to_string_lossy().into_owned());
        }
        if dir == root {
            return None;
        }
        current = dir.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs;
    use std::sync::Mutex;
    use tempfile::tempdir;

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn collect(root: &Path) -> Vec<WalkEntry> {
        let cancel = AtomicBool::new(false);
        let found = Mutex::new(Vec::new());
        walk_root(root, &cancel, |entry| {
            found.lock().unwrap().push(entry);
        });
        let mut entries = found.into_inner().unwrap();
        entries.sort_by(|a, b| a.path.cmp(&b.path));
        entries
    }

    #[test]
    fn finds_targets_and_ignores_everything_else() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("CLAUDE.md"), "a");
        write(&root.join("README.md"), "b");
        write(&root.join(".claude/skills/demo/SKILL.md"), "c");
        write(&root.join(".cursor/rules/style.mdc"), "d");
        write(&root.join("packages/api/AGENTS.md"), "e");

        let paths: HashSet<String> = collect(root)
            .iter()
            .map(|entry| {
                entry
                    .path
                    .strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();

        assert_eq!(
            paths,
            HashSet::from([
                "CLAUDE.md".to_string(),
                ".claude/skills/demo/SKILL.md".to_string(),
                ".cursor/rules/style.mdc".to_string(),
                "packages/api/AGENTS.md".to_string(),
            ])
        );
    }

    #[test]
    fn skips_build_directories_but_not_dot_claude() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("node_modules/pkg/CLAUDE.md"), "a");
        write(&root.join("target/debug/AGENTS.md"), "b");
        write(&root.join(".claude/agents/reviewer.md"), "c");

        let entries = collect(root);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].kind, FileKind::ClaudeAgent);
    }

    #[test]
    fn walks_into_symlinked_skill_directories() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("shared/humanizer/SKILL.md"), "a");
        fs::create_dir_all(root.join(".claude/skills")).unwrap();
        std::os::unix::fs::symlink(
            root.join("shared/humanizer"),
            root.join(".claude/skills/humanizer"),
        )
        .unwrap();

        let entries = collect(&root.join(".claude"));

        assert_eq!(
            entries
                .iter()
                .map(|entry| entry.path.strip_prefix(root).unwrap().to_string_lossy())
                .collect::<Vec<_>>(),
            vec![".claude/skills/humanizer/SKILL.md"],
            "the skill is indexed under the path the agent resolves"
        );
    }

    #[test]
    fn a_symlink_loop_does_not_hang_the_walk() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join(".claude/skills/demo/SKILL.md"), "a");
        std::os::unix::fs::symlink(root, root.join(".claude/skills/demo/self")).unwrap();

        assert_eq!(collect(root).len(), 1);
    }

    #[test]
    fn ignores_the_gitignore_of_the_scanned_repo() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join(".gitignore"), ".claude/\nCLAUDE.md\n");
        write(&root.join("CLAUDE.md"), "a");
        write(&root.join(".claude/agents/reviewer.md"), "b");

        assert_eq!(collect(root).len(), 2);
    }

    #[test]
    fn records_symlinks_with_the_target_content_stats() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        write(&root.join("source/AGENTS.md"), "shared content");
        fs::create_dir_all(root.join("consumer")).unwrap();
        std::os::unix::fs::symlink(
            root.join("source/AGENTS.md"),
            root.join("consumer/AGENTS.md"),
        )
        .unwrap();

        let entries = collect(root);
        let linked = entries
            .iter()
            .find(|entry| entry.path.ends_with("consumer/AGENTS.md"))
            .unwrap();

        assert!(linked.is_symlink);
        assert_eq!(linked.size, "shared content".len() as i64);
        assert!(linked
            .symlink_target
            .as_ref()
            .unwrap()
            .ends_with("source/AGENTS.md"));
    }

    #[test]
    fn drops_broken_symlinks() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("consumer")).unwrap();
        std::os::unix::fs::symlink(root.join("missing.md"), root.join("consumer/AGENTS.md"))
            .unwrap();

        assert!(collect(root).is_empty());
    }

    #[test]
    fn cancelling_stops_the_walk() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        for index in 0..50 {
            write(&root.join(format!("p{index}/CLAUDE.md")), "x");
        }

        let cancel = AtomicBool::new(true);
        let found = Mutex::new(Vec::new());
        walk_root(root, &cancel, |entry| found.lock().unwrap().push(entry));

        assert!(found.into_inner().unwrap().is_empty());
    }

    #[test]
    fn project_dir_is_the_nearest_git_ancestor() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("repo/.git")).unwrap();
        write(&root.join("repo/packages/api/AGENTS.md"), "a");
        write(&root.join("loose/AGENTS.md"), "b");

        let inside = project_dir_of(&root.join("repo/packages/api/AGENTS.md"), root);
        let outside = project_dir_of(&root.join("loose/AGENTS.md"), root);

        assert_eq!(
            inside,
            Some(root.join("repo").to_string_lossy().into_owned())
        );
        assert_eq!(outside, None);
    }
}
