use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

use crate::error::{AppError, AppResult};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy)]
pub struct FileStat {
    pub size: i64,
    pub mtime_ns: i64,
}

impl FileStat {
    pub fn mtime_ms(self) -> i64 {
        self.mtime_ns / 1_000_000
    }
}

pub fn stat(path: &Path) -> AppResult<FileStat> {
    let metadata = fs::metadata(path)?;
    let mtime_ns = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_nanos() as i64)
        .unwrap_or_default();

    Ok(FileStat {
        size: metadata.len() as i64,
        mtime_ns,
    })
}

pub fn read_text(path: &Path) -> AppResult<(String, Vec<u8>)> {
    let bytes = fs::read(path)?;
    let text = String::from_utf8(bytes.clone())
        .map_err(|_| AppError::InvalidPath(format!("{} is not valid UTF-8", path.display())))?;
    Ok((text, bytes))
}

fn temp_sibling(target: &Path) -> AppResult<PathBuf> {
    let dir = target
        .parent()
        .ok_or_else(|| AppError::InvalidPath(format!("{} has no parent", target.display())))?;
    let name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file");
    let unique = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    Ok(dir.join(format!(".{name}.{}.{unique}.tmp", std::process::id())))
}

/// Writes through a symlink instead of replacing it — a renamed temp file over a
/// link would silently turn a synced copy back into a standalone file.
pub fn atomic_write(path: &Path, content: &str) -> AppResult<()> {
    let target = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let temp = temp_sibling(&target)?;

    let result = (|| -> AppResult<()> {
        fs::write(&temp, content)?;
        if let Ok(metadata) = fs::metadata(&target) {
            let _ = fs::set_permissions(&temp, metadata.permissions());
        }
        fs::rename(&temp, &target)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn writes_and_reads_back_the_same_text() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("CLAUDE.md");

        atomic_write(&path, "# hello\n").unwrap();

        assert_eq!(read_text(&path).unwrap().0, "# hello\n");
    }

    #[test]
    fn leaves_no_temp_file_behind() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("CLAUDE.md");

        atomic_write(&path, "one").unwrap();
        atomic_write(&path, "two").unwrap();

        let entries: Vec<String> = fs::read_dir(dir.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["CLAUDE.md".to_string()]);
    }

    #[test]
    fn writing_through_a_symlink_keeps_the_link() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("source.md");
        let link = dir.path().join("linked.md");
        fs::write(&target, "original").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();

        atomic_write(&link, "updated").unwrap();

        assert!(fs::symlink_metadata(&link).unwrap().is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "updated");
    }

    #[test]
    fn preserves_the_executable_bit() {
        use std::os::unix::fs::PermissionsExt as _;
        let dir = tempdir().unwrap();
        let path = dir.path().join("hook.md");
        fs::write(&path, "one").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();

        atomic_write(&path, "two").unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o755);
    }

    #[test]
    fn reports_size_and_mtime() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("CLAUDE.md");
        fs::write(&path, "12345").unwrap();

        let stat = stat(&path).unwrap();

        assert_eq!(stat.size, 5);
        assert!(stat.mtime_ns > 0);
        assert_eq!(stat.mtime_ms(), stat.mtime_ns / 1_000_000);
    }

    #[test]
    fn rejects_non_utf8_content() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("binary.md");
        fs::write(&path, [0xff, 0xfe, 0x00]).unwrap();

        assert_eq!(read_text(&path).unwrap_err().code(), "invalid_path");
    }
}
