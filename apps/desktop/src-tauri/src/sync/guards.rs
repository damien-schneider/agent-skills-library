use std::path::Path;
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SyncWarning {
    /// a committed symlink breaks CI and every collaborator that checks the repo out
    GitTracked,
    /// Windows needs Developer Mode or admin rights to create symlinks
    WindowsSymlink,
    /// iCloud, Dropbox and friends replace symlinks with copies or placeholders
    CloudFolder,
    /// the member already points somewhere else
    ExistingSymlink,
}

const CLOUD_MARKERS: &[&str] = &[
    "Library/Mobile Documents",
    "/iCloud",
    "/Dropbox",
    "/Google Drive",
    "/OneDrive",
    "/pCloud",
    "/Sync.com",
];

pub fn is_in_cloud_folder(path: &Path) -> bool {
    let text = path.to_string_lossy();
    CLOUD_MARKERS.iter().any(|marker| text.contains(marker))
}

/// Shells out to git: parsing the index ourselves would be a second source of truth.
pub fn is_git_tracked(path: &Path) -> bool {
    let Some(dir) = path.parent() else {
        return false;
    };
    Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["ls-files", "--error-unmatch", "--"])
        .arg(path)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Warnings for turning `path` into a symlink; copy targets only inherit the cloud one.
pub fn symlink_warnings(path: &Path) -> Vec<SyncWarning> {
    let mut warnings = Vec::new();

    if is_git_tracked(path) {
        warnings.push(SyncWarning::GitTracked);
    }
    if is_in_cloud_folder(path) {
        warnings.push(SyncWarning::CloudFolder);
    }
    if cfg!(windows) {
        warnings.push(SyncWarning::WindowsSymlink);
    }
    if std::fs::symlink_metadata(path).is_ok_and(|metadata| metadata.is_symlink()) {
        warnings.push(SyncWarning::ExistingSymlink);
    }

    warnings
}

pub fn copy_warnings(path: &Path) -> Vec<SyncWarning> {
    let mut warnings = Vec::new();
    if std::fs::symlink_metadata(path).is_ok_and(|metadata| metadata.is_symlink()) {
        warnings.push(SyncWarning::ExistingSymlink);
    }
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn flags_known_cloud_folders() {
        assert!(is_in_cloud_folder(Path::new(
            "/Users/me/Library/Mobile Documents/com~apple~CloudDocs/CLAUDE.md"
        )));
        assert!(is_in_cloud_folder(Path::new("/Users/me/Dropbox/CLAUDE.md")));
        assert!(!is_in_cloud_folder(Path::new(
            "/Users/me/Documents/GitHub/CLAUDE.md"
        )));
    }

    #[test]
    fn an_untracked_file_is_not_git_tracked() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("CLAUDE.md");
        fs::write(&path, "x").unwrap();

        assert!(!is_git_tracked(&path));
    }

    #[test]
    fn a_staged_file_is_git_tracked() {
        let dir = tempdir().unwrap();
        let repo = dir.path();
        let path = repo.join("AGENTS.md");
        fs::write(&path, "x").unwrap();

        let git = |args: &[&str]| {
            Command::new("git")
                .arg("-C")
                .arg(repo)
                .args(args)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap()
                .success()
        };
        assert!(git(&["init"]), "git must be available for this test");
        assert!(git(&["add", "AGENTS.md"]));

        assert!(is_git_tracked(&path));
        assert!(!is_git_tracked(&repo.join("untracked.md")));
    }

    #[test]
    fn symlink_warnings_flag_an_existing_link() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("source.md");
        let link = dir.path().join("linked.md");
        fs::write(&target, "x").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();

        assert!(symlink_warnings(&link).contains(&SyncWarning::ExistingSymlink));
        assert!(symlink_warnings(&target).is_empty());
    }

    #[test]
    fn copy_warnings_only_flag_symlinks() {
        let dir = tempdir().unwrap();
        let plain = dir.path().join("CLAUDE.md");
        fs::write(&plain, "x").unwrap();

        assert!(copy_warnings(&plain).is_empty());
    }

    #[test]
    fn warnings_serialize_in_kebab_case() {
        let json = serde_json::to_string(&SyncWarning::GitTracked).unwrap();

        assert_eq!(json, "\"git-tracked\"");
    }
}
