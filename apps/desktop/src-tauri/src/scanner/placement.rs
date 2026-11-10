use std::path::{Path, PathBuf};

use crate::db::aliases_repo::AliasRecord;
use crate::db::roots_repo::Root;

use super::targets::{classify, is_skipped_below, FileKind};

/// One path through which a real file is reached, and the root that path sits in.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reach {
    pub path: PathBuf,
    pub root_id: i64,
}

/// Where one real file is indexed, and every other path that merely leads to it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Placement {
    pub path: PathBuf,
    pub root_id: i64,
    pub kind: FileKind,
    pub aliases: Vec<AliasRecord>,
}

pub fn owning_root<'a>(roots: &'a [Root], path: &Path) -> Option<&'a Root> {
    roots
        .iter()
        .filter(|root| path.starts_with(Path::new(&root.path)))
        .max_by_key(|root| root.path.len())
}

/// A real path carries the row itself only where a walk would index it under that
/// very name: inside an enabled root, a target by its own name, below no skipped
/// directory. Anywhere else the row has to live at one of the paths leading to it.
pub fn home_of<'a>(real: &Path, roots: &'a [Root]) -> Option<(&'a Root, FileKind)> {
    let root = owning_root(roots, real)?;
    let kind = classify(real)?;
    (!is_skipped_below(Path::new(&root.path), real)).then_some((root, kind))
}

/// Picks the row's path from nothing but the set of paths and roots, so the answer
/// is the same whichever path was met first and whichever root was walked first.
/// `roots` are the enabled ones; `reaches` every path known to lead to `real`.
pub fn place(real: &Path, reaches: &[Reach], roots: &[Root]) -> Option<Placement> {
    let (path, root_id, kind) = match home_of(real, roots) {
        Some((root, kind)) => (real.to_path_buf(), root.id, kind),
        None => {
            // byte order, not component order: it has to agree with the sorted
            // strings the index stores
            let first = reaches
                .iter()
                .min_by(|a, b| a.path.as_os_str().cmp(b.path.as_os_str()))?;
            (first.path.clone(), first.root_id, classify(&first.path)?)
        }
    };

    let mut aliases: Vec<AliasRecord> = reaches
        .iter()
        .filter(|reach| reach.path != path)
        .map(|reach| AliasRecord {
            path: reach.path.to_string_lossy().into_owned(),
            root_id: reach.root_id,
        })
        .collect();
    aliases.sort_by(|a, b| a.path.cmp(&b.path));
    aliases.dedup_by(|a, b| a.path == b.path);

    Some(Placement {
        path,
        root_id,
        kind,
        aliases,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root(id: i64, path: &str) -> Root {
        Root {
            id,
            path: path.to_string(),
            enabled: true,
            added_at: 0,
        }
    }

    fn reach(path: &str, root_id: i64) -> Reach {
        Reach {
            path: PathBuf::from(path),
            root_id,
        }
    }

    fn alias_paths(placement: &Placement) -> Vec<&str> {
        placement
            .aliases
            .iter()
            .map(|alias| alias.path.as_str())
            .collect()
    }

    #[test]
    fn picks_the_deepest_owning_root() {
        let roots = [root(1, "/repo"), root(2, "/repo/nested")];

        let owner = owning_root(&roots, Path::new("/repo/nested/CLAUDE.md"));

        assert_eq!(owner.map(|root| root.id), Some(2));
    }

    #[test]
    fn a_real_path_inside_a_root_carries_the_row() {
        let roots = [root(1, "/repo")];
        let real = Path::new("/repo/.agents/skills/a/SKILL.md");
        let reaches = [
            reach("/repo/.claude/skills/a/SKILL.md", 1),
            reach("/repo/.agents/skills/a/SKILL.md", 1),
        ];

        let placement = place(real, &reaches, &roots).unwrap();

        assert_eq!(placement.path, real);
        assert_eq!(placement.kind, FileKind::Skill);
        assert_eq!(alias_paths(&placement), ["/repo/.claude/skills/a/SKILL.md"]);
    }

    #[test]
    fn the_order_the_paths_were_met_in_changes_nothing() {
        let roots = [root(1, "/repo")];
        let real = Path::new("/elsewhere/a/SKILL.md");
        let forward = [
            reach("/repo/x/a/SKILL.md", 1),
            reach("/repo/b/a/SKILL.md", 1),
            reach("/repo/m/a/SKILL.md", 1),
        ];
        let backward: Vec<Reach> = forward.iter().rev().cloned().collect();

        assert_eq!(
            place(real, &forward, &roots),
            place(real, &backward, &roots)
        );
    }

    #[test]
    fn a_target_outside_the_roots_is_indexed_at_its_smallest_alias() {
        let roots = [root(1, "/home/.claude"), root(2, "/repo")];
        let real = Path::new("/home/.agents/skills/a/SKILL.md");
        let reaches = [
            reach("/repo/.claude/skills/a/SKILL.md", 2),
            reach("/home/.claude/skills/a/SKILL.md", 1),
        ];

        let placement = place(real, &reaches, &roots).unwrap();

        assert_eq!(placement.path, Path::new("/home/.claude/skills/a/SKILL.md"));
        assert_eq!(placement.root_id, 1);
        assert_eq!(alias_paths(&placement), ["/repo/.claude/skills/a/SKILL.md"]);
    }

    #[test]
    fn the_row_follows_the_real_path_into_another_root() {
        let roots = [root(1, "/home/.claude"), root(2, "/home/.agents")];
        let real = Path::new("/home/.agents/skills/a/SKILL.md");
        let reaches = [reach("/home/.claude/skills/a/SKILL.md", 1)];

        let placement = place(real, &reaches, &roots).unwrap();

        assert_eq!(placement.path, real);
        assert_eq!(placement.root_id, 2);
        assert_eq!(
            placement.aliases,
            [AliasRecord {
                path: "/home/.claude/skills/a/SKILL.md".to_string(),
                root_id: 1
            }]
        );
    }

    #[test]
    fn the_row_takes_the_kind_of_the_path_it_lives_at() {
        let roots = [root(1, "/repo")];
        let real = Path::new("/repo/AGENTS.md");
        let reaches = [reach("/repo/CLAUDE.md", 1), reach("/repo/AGENTS.md", 1)];

        let placement = place(real, &reaches, &roots).unwrap();

        assert_eq!(placement.kind, FileKind::AgentsMd);
        assert_eq!(alias_paths(&placement), ["/repo/CLAUDE.md"]);
    }

    #[test]
    fn a_real_path_no_walk_would_index_cannot_carry_the_row() {
        let roots = [root(1, "/repo")];
        let unnamed = Path::new("/repo/docs/instructions.md");
        let vendored = Path::new("/repo/node_modules/pkg/AGENTS.md");
        let reaches = [reach("/repo/CLAUDE.md", 1)];

        for real in [unnamed, vendored] {
            let placement = place(real, &reaches, &roots).unwrap();

            assert_eq!(placement.path, Path::new("/repo/CLAUDE.md"));
            assert_eq!(placement.kind, FileKind::ClaudeMd);
            assert!(placement.aliases.is_empty());
        }
    }

    #[test]
    fn a_file_nothing_reaches_has_no_place() {
        let roots = [root(1, "/repo")];

        assert_eq!(place(Path::new("/elsewhere/SKILL.md"), &[], &roots), None);
    }
}
