use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::db::files_repo::{self, FileRow};
use crate::db::groups_repo::{self, Strategy, SyncGroup};
use crate::db::{backups_repo, now_ms, Db};
use crate::error::{AppError, AppResult};
use crate::fsops;
use crate::scanner::hash::hash_bytes;

use super::diff::{diff_text, DiffResult};
use super::guards::{copy_warnings, symlink_warnings, SyncWarning};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MemberStatus {
    InSync,
    Drifted,
    Missing,
    Symlinked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SyncAction {
    Skip,
    Copy,
    Symlink,
    Create,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberPlan {
    pub file_id: i64,
    pub path: String,
    pub rel_path: String,
    pub strategy: Strategy,
    pub status: MemberStatus,
    pub action: SyncAction,
    pub warnings: Vec<SyncWarning>,
    pub diff: Option<DiffResult>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPreview {
    pub group_id: i64,
    pub group_name: String,
    pub canonical_file_id: i64,
    pub canonical_path: String,
    /// fingerprint of everything the plan was computed from; `apply` refuses a stale one
    pub token: String,
    pub members: Vec<MemberPlan>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub updated_file_ids: Vec<i64>,
    pub backup_ids: Vec<i64>,
    pub skipped: usize,
}

fn canonical_of(db: &Db, group: &SyncGroup) -> AppResult<FileRow> {
    let file_id = group.canonical_file_id.ok_or_else(|| {
        AppError::InvalidPath(format!("sync group {} has no canonical file", group.id))
    })?;
    db.with_conn(|conn| files_repo::require(conn, file_id))
}

fn points_at(path: &Path, canonical: &Path) -> bool {
    match (path.canonicalize(), canonical.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn classify_member(
    path: &Path,
    canonical_path: &Path,
    canonical_text: &str,
    strategy: Strategy,
) -> (MemberStatus, SyncAction, Option<DiffResult>) {
    if !path.exists() {
        return (MemberStatus::Missing, SyncAction::Create, None);
    }

    let is_symlink = std::fs::symlink_metadata(path).is_ok_and(|meta| meta.is_symlink());
    if is_symlink && points_at(path, canonical_path) {
        let action = match strategy {
            Strategy::Symlink => SyncAction::Skip,
            Strategy::Copy => SyncAction::Copy,
        };
        return (MemberStatus::Symlinked, action, None);
    }

    let Ok((text, _)) = fsops::read_text(path) else {
        return (MemberStatus::Drifted, SyncAction::Copy, None);
    };

    if text == canonical_text {
        let action = match strategy {
            Strategy::Copy => SyncAction::Skip,
            Strategy::Symlink => SyncAction::Symlink,
        };
        return (MemberStatus::InSync, action, None);
    }

    let action = match strategy {
        Strategy::Copy => SyncAction::Copy,
        Strategy::Symlink => SyncAction::Symlink,
    };
    (
        MemberStatus::Drifted,
        action,
        Some(diff_text(&text, canonical_text)),
    )
}

fn disk_fingerprint(path: &Path) -> String {
    std::fs::read(path)
        .map(|bytes| hash_bytes(&bytes))
        .unwrap_or_else(|_| "missing".to_string())
}

fn plan_token(canonical_path: &Path, members: &[(i64, PathBuf)]) -> String {
    let mut material = disk_fingerprint(canonical_path);
    for (file_id, path) in members {
        material.push_str(&format!("|{file_id}:{}", disk_fingerprint(path)));
    }
    hash_bytes(material.as_bytes())
}

pub fn preview(db: &Db, group_id: i64) -> AppResult<SyncPreview> {
    let group = db.with_conn(|conn| groups_repo::require(conn, group_id))?;
    let canonical = canonical_of(db, &group)?;
    let canonical_path = PathBuf::from(&canonical.path);
    let (canonical_text, _) = fsops::read_text(&canonical_path)?;

    let members = db.with_conn(|conn| groups_repo::members(conn, group_id))?;
    let mut plans = Vec::with_capacity(members.len());
    let mut fingerprint_input = Vec::with_capacity(members.len());

    for member in members {
        let row = db.with_conn(|conn| files_repo::require(conn, member.file_id))?;
        let path = PathBuf::from(&row.path);
        let (status, action, diff) =
            classify_member(&path, &canonical_path, &canonical_text, member.strategy);

        let warnings = match member.strategy {
            Strategy::Symlink => symlink_warnings(&path),
            Strategy::Copy => copy_warnings(&path),
        };

        fingerprint_input.push((member.file_id, path));
        plans.push(MemberPlan {
            file_id: row.id,
            path: row.path,
            rel_path: row.rel_path,
            strategy: member.strategy,
            status,
            action,
            warnings,
            diff,
        });
    }

    Ok(SyncPreview {
        group_id,
        group_name: group.name,
        canonical_file_id: canonical.id,
        canonical_path: canonical.path,
        token: plan_token(&canonical_path, &fingerprint_input),
        members: plans,
    })
}

fn backup_file(db: &Db, backups_dir: &Path, row: &FileRow, path: &Path) -> AppResult<Option<i64>> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(path)?;
    let dir = backups_dir.join(row.id.to_string());
    std::fs::create_dir_all(&dir)?;

    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file");
    let created_at = now_ms();
    let backup_path = dir.join(format!("{created_at}-{name}"));
    std::fs::write(&backup_path, &bytes)?;

    let id = db.with_conn(|conn| {
        backups_repo::insert(
            conn,
            Some(row.id),
            &row.path,
            &backup_path.to_string_lossy(),
            &hash_bytes(&bytes),
            created_at,
        )
    })?;
    Ok(Some(id))
}

/// Replaces whatever is at `path`, symlink included, with a real file.
fn write_copy(path: &Path, content: &str) -> AppResult<()> {
    if std::fs::symlink_metadata(path).is_ok() {
        std::fs::remove_file(path)?;
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    fsops::atomic_write(path, content)
}

fn write_symlink(path: &Path, canonical_path: &Path) -> AppResult<()> {
    if std::fs::symlink_metadata(path).is_ok() {
        std::fs::remove_file(path)?;
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::os::unix::fs::symlink(canonical_path, path)?;
    Ok(())
}

fn refresh_row(db: &Db, file_id: i64, path: &Path, hash: &str) -> AppResult<()> {
    let stat = fsops::stat(path)?;
    let is_symlink = std::fs::symlink_metadata(path).is_ok_and(|meta| meta.is_symlink());
    let target = is_symlink
        .then(|| std::fs::read_link(path).ok())
        .flatten()
        .map(|target| target.to_string_lossy().into_owned());

    db.with_conn(|conn| {
        files_repo::touch_after_write(conn, file_id, stat.size, stat.mtime_ns, hash)?;
        conn.execute(
            "UPDATE files SET is_symlink = ?2, symlink_target = ?3 WHERE id = ?1",
            rusqlite::params![file_id, i64::from(is_symlink), target],
        )?;
        Ok(())
    })
}

pub fn apply(db: &Db, group_id: i64, token: &str, backups_dir: &Path) -> AppResult<ApplyResult> {
    let plan = preview(db, group_id)?;
    if plan.token != token {
        return Err(AppError::Conflict(plan.group_name));
    }

    let canonical_path = PathBuf::from(&plan.canonical_path);
    let (canonical_text, canonical_bytes) = fsops::read_text(&canonical_path)?;
    let canonical_hash = hash_bytes(&canonical_bytes);

    let mut updated = Vec::new();
    let mut backups = Vec::new();
    let mut skipped = 0;

    for member in &plan.members {
        if member.action == SyncAction::Skip {
            skipped += 1;
            continue;
        }

        let path = PathBuf::from(&member.path);
        let row = db.with_conn(|conn| files_repo::require(conn, member.file_id))?;
        if let Some(backup_id) = backup_file(db, backups_dir, &row, &path)? {
            backups.push(backup_id);
        }

        match member.action {
            SyncAction::Symlink => write_symlink(&path, &canonical_path)?,
            SyncAction::Copy | SyncAction::Create => write_copy(&path, &canonical_text)?,
            SyncAction::Skip => unreachable!("skipped above"),
        }

        refresh_row(db, member.file_id, &path, &canonical_hash)?;
        db.with_conn(|conn| {
            groups_repo::set_baseline(conn, group_id, member.file_id, &canonical_hash)
        })?;
        updated.push(member.file_id);
    }

    Ok(ApplyResult {
        updated_file_ids: updated,
        backup_ids: backups,
        skipped,
    })
}

pub fn restore(db: &Db, backup_id: i64) -> AppResult<i64> {
    let backup = db.with_conn(|conn| backups_repo::require(conn, backup_id))?;
    let original = PathBuf::from(&backup.original_path);
    let bytes = std::fs::read(&backup.backup_path)?;
    let content = String::from_utf8(bytes.clone())
        .map_err(|_| AppError::InvalidPath(format!("{} is not valid UTF-8", backup.backup_path)))?;

    write_copy(&original, &content)?;

    let file_id = backup.file_id.unwrap_or_default();
    if file_id != 0 {
        refresh_row(db, file_id, &original, &hash_bytes(&bytes))?;
    }
    Ok(file_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::files_repo::FileRecord;
    use crate::db::roots_repo;
    use crate::scanner::targets::FileKind;
    use std::fs;
    use tempfile::{tempdir, TempDir};

    struct Fixture {
        db: Db,
        dir: TempDir,
        backups: TempDir,
        group_id: i64,
        canonical_id: i64,
        member_id: i64,
    }

    fn index(db: &Db, root_id: i64, path: &Path, root: &Path) -> i64 {
        let bytes = fs::read(path).unwrap_or_default();
        let stat = fsops::stat(path).unwrap();
        let record = FileRecord {
            root_id,
            path: path.to_string_lossy().into_owned(),
            rel_path: path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            kind: FileKind::AgentsMd,
            name: None,
            project_dir: None,
            size: stat.size,
            mtime_ns: stat.mtime_ns,
            hash: hash_bytes(&bytes),
            is_symlink: false,
            symlink_target: None,
        };
        db.with_conn(|conn| files_repo::upsert(conn, &record, 1, 0))
            .unwrap()
    }

    fn fixture(strategy: Strategy) -> Fixture {
        let dir = tempdir().unwrap();
        let backups = tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let db = Db::open_in_memory().unwrap();

        fs::create_dir_all(root.join("a")).unwrap();
        fs::create_dir_all(root.join("b")).unwrap();
        fs::write(root.join("a/AGENTS.md"), "canonical\n").unwrap();
        fs::write(root.join("b/AGENTS.md"), "drifted\n").unwrap();

        let root_id = db
            .with_conn(|conn| roots_repo::insert(conn, &root.to_string_lossy(), 0))
            .unwrap();
        let canonical_id = index(&db, root_id, &root.join("a/AGENTS.md"), &root);
        let member_id = index(&db, root_id, &root.join("b/AGENTS.md"), &root);

        let group_id = db
            .with_conn(|conn| {
                let id = groups_repo::create(conn, "agents", canonical_id, 0)?;
                groups_repo::add_member(conn, id, member_id, strategy)?;
                Ok(id)
            })
            .unwrap();

        Fixture {
            db,
            dir,
            backups,
            group_id,
            canonical_id,
            member_id,
        }
    }

    fn member_path(fx: &Fixture) -> PathBuf {
        fx.dir.path().canonicalize().unwrap().join("b/AGENTS.md")
    }

    #[test]
    fn preview_reports_a_drifted_member_with_its_diff() {
        let fx = fixture(Strategy::Copy);

        let plan = preview(&fx.db, fx.group_id).unwrap();

        assert_eq!(plan.canonical_file_id, fx.canonical_id);
        assert_eq!(plan.members.len(), 1);
        assert_eq!(plan.members[0].status, MemberStatus::Drifted);
        assert_eq!(plan.members[0].action, SyncAction::Copy);
        assert!(!plan.members[0].diff.as_ref().unwrap().identical);
    }

    #[test]
    fn apply_copies_the_canonical_content_and_backs_the_target_up() {
        let fx = fixture(Strategy::Copy);
        let plan = preview(&fx.db, fx.group_id).unwrap();

        let result = apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        assert_eq!(result.updated_file_ids, vec![fx.member_id]);
        assert_eq!(result.backup_ids.len(), 1);
        assert_eq!(fs::read_to_string(member_path(&fx)).unwrap(), "canonical\n");
        let backups = fx
            .db
            .with_conn(|conn| backups_repo::list(conn, None))
            .unwrap();
        assert_eq!(
            fs::read_to_string(&backups[0].backup_path).unwrap(),
            "drifted\n"
        );
    }

    #[test]
    fn apply_refuses_a_stale_token() {
        let fx = fixture(Strategy::Copy);
        let plan = preview(&fx.db, fx.group_id).unwrap();
        fs::write(member_path(&fx), "changed under us\n").unwrap();

        let err = apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap_err();

        assert_eq!(err.code(), "conflict");
        assert_eq!(
            fs::read_to_string(member_path(&fx)).unwrap(),
            "changed under us\n",
            "a refused apply touches nothing"
        );
    }

    #[test]
    fn a_second_apply_skips_an_in_sync_member() {
        let fx = fixture(Strategy::Copy);
        let plan = preview(&fx.db, fx.group_id).unwrap();
        apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        let plan = preview(&fx.db, fx.group_id).unwrap();
        let result = apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        assert_eq!(plan.members[0].status, MemberStatus::InSync);
        assert_eq!(result.skipped, 1);
        assert!(result.updated_file_ids.is_empty());
    }

    #[test]
    fn the_symlink_strategy_replaces_the_member_with_a_link() {
        let fx = fixture(Strategy::Symlink);
        let plan = preview(&fx.db, fx.group_id).unwrap();

        apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        let path = member_path(&fx);
        assert!(fs::symlink_metadata(&path).unwrap().is_symlink());
        assert_eq!(fs::read_to_string(&path).unwrap(), "canonical\n");
        let row = fx
            .db
            .with_conn(|conn| files_repo::require(conn, fx.member_id))
            .unwrap();
        assert!(row.is_symlink);
        assert!(row.symlink_target.unwrap().ends_with("a/AGENTS.md"));
    }

    #[test]
    fn a_symlinked_member_is_reported_in_sync_and_skipped() {
        let fx = fixture(Strategy::Symlink);
        let plan = preview(&fx.db, fx.group_id).unwrap();
        apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        let plan = preview(&fx.db, fx.group_id).unwrap();

        assert_eq!(plan.members[0].status, MemberStatus::Symlinked);
        assert_eq!(plan.members[0].action, SyncAction::Skip);
    }

    #[test]
    fn switching_back_to_copy_materialises_a_real_file() {
        let fx = fixture(Strategy::Symlink);
        let plan = preview(&fx.db, fx.group_id).unwrap();
        apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        fx.db
            .with_conn(|conn| {
                groups_repo::add_member(conn, fx.group_id, fx.member_id, Strategy::Copy)
            })
            .unwrap();
        let plan = preview(&fx.db, fx.group_id).unwrap();
        apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        let path = member_path(&fx);
        assert!(!fs::symlink_metadata(&path).unwrap().is_symlink());
        assert_eq!(fs::read_to_string(&path).unwrap(), "canonical\n");
        assert_eq!(
            fs::read_to_string(fx.dir.path().canonicalize().unwrap().join("a/AGENTS.md")).unwrap(),
            "canonical\n",
            "the canonical file is never written through"
        );
    }

    #[test]
    fn a_missing_member_is_recreated() {
        let fx = fixture(Strategy::Copy);
        fs::remove_file(member_path(&fx)).unwrap();

        let plan = preview(&fx.db, fx.group_id).unwrap();
        let result = apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        assert_eq!(plan.members[0].status, MemberStatus::Missing);
        assert_eq!(plan.members[0].action, SyncAction::Create);
        assert!(result.backup_ids.is_empty(), "nothing to back up");
        assert_eq!(fs::read_to_string(member_path(&fx)).unwrap(), "canonical\n");
    }

    #[test]
    fn restore_puts_the_backed_up_content_back() {
        let fx = fixture(Strategy::Copy);
        let plan = preview(&fx.db, fx.group_id).unwrap();
        let result = apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        let restored = restore(&fx.db, result.backup_ids[0]).unwrap();

        assert_eq!(restored, fx.member_id);
        assert_eq!(fs::read_to_string(member_path(&fx)).unwrap(), "drifted\n");
        let row = fx
            .db
            .with_conn(|conn| files_repo::require(conn, fx.member_id))
            .unwrap();
        assert_eq!(row.hash, hash_bytes(b"drifted\n"));
    }

    #[test]
    fn apply_records_the_baseline_hash() {
        let fx = fixture(Strategy::Copy);
        let plan = preview(&fx.db, fx.group_id).unwrap();

        apply(&fx.db, fx.group_id, &plan.token, fx.backups.path()).unwrap();

        let members = fx
            .db
            .with_conn(|conn| groups_repo::members(conn, fx.group_id))
            .unwrap();
        assert_eq!(members[0].baseline_hash, Some(hash_bytes(b"canonical\n")));
    }

    #[test]
    fn a_group_without_a_canonical_file_cannot_be_previewed() {
        let fx = fixture(Strategy::Copy);
        fx.db
            .with_conn(|conn| {
                conn.execute(
                    "UPDATE sync_groups SET canonical_file_id = NULL WHERE id = ?1",
                    [fx.group_id],
                )?;
                Ok(())
            })
            .unwrap();

        assert_eq!(
            preview(&fx.db, fx.group_id).unwrap_err().code(),
            "invalid_path"
        );
    }
}
