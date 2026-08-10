use std::fs;
use std::io;
use std::path::Path;

/// below this, a plain read beats paying for the mmap syscalls
const MMAP_THRESHOLD: u64 = 64 * 1024;

pub fn hash_file(path: &Path, size: u64) -> io::Result<String> {
    let mut hasher = blake3::Hasher::new();
    if size >= MMAP_THRESHOLD {
        hasher.update_mmap_rayon(path)?;
    } else {
        hasher.update(&fs::read(path)?);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    blake3::hash(bytes).to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write as _;
    use tempfile::tempdir;

    fn write(dir: &Path, name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = dir.join(name);
        let mut file = fs::File::create(&path).unwrap();
        file.write_all(bytes).unwrap();
        path
    }

    #[test]
    fn hashes_a_small_file_like_its_bytes() {
        let dir = tempdir().unwrap();
        let path = write(dir.path(), "small.md", b"# hello\n");

        assert_eq!(hash_file(&path, 8).unwrap(), hash_bytes(b"# hello\n"));
    }

    #[test]
    fn hashes_an_empty_file() {
        let dir = tempdir().unwrap();
        let path = write(dir.path(), "empty.md", b"");

        assert_eq!(hash_file(&path, 0).unwrap(), hash_bytes(b""));
    }

    #[test]
    fn takes_the_mmap_path_above_the_threshold() {
        let dir = tempdir().unwrap();
        let bytes = vec![b'x'; (MMAP_THRESHOLD as usize) + 1];
        let path = write(dir.path(), "big.md", &bytes);

        assert_eq!(
            hash_file(&path, bytes.len() as u64).unwrap(),
            hash_bytes(&bytes)
        );
    }

    #[test]
    fn different_content_hashes_differently() {
        assert_ne!(hash_bytes(b"a"), hash_bytes(b"b"));
    }
}
