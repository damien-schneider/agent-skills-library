pub mod backups_repo;
pub mod destinations_repo;
pub mod favorite_projects_repo;
pub mod files_repo;
pub mod groups_repo;
pub mod prompts_repo;
pub mod roots_repo;
pub mod schema;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{Connection, OptionalExtension as _, Transaction};

use crate::error::{AppError, AppResult};

pub const META_DEFAULT_ROOTS_SEEDED: &str = "default_roots_seeded";
pub const META_WATCHER_ENABLED: &str = "watcher_enabled";
const META_SCHEMA_VERSION: &str = "schema_version";

/// Single writer behind a mutex: the scanner batches, the commands are short.
pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        Self::from_connection(conn)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> AppResult<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    fn from_connection(conn: Connection) -> AppResult<Self> {
        // execute_batch, not pragma_update: journal_mode answers with a row
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;",
        )?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.migrate()?;
        Ok(db)
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| AppError::internal("database mutex poisoned"))
    }

    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let conn = self.lock()?;
        f(&conn)
    }

    pub fn with_tx<T>(&self, f: impl FnOnce(&Transaction) -> AppResult<T>) -> AppResult<T> {
        let mut conn = self.lock()?;
        let tx = conn.transaction()?;
        let value = f(&tx)?;
        tx.commit()?;
        Ok(value)
    }

    fn migrate(&self) -> AppResult<()> {
        let conn = self.lock()?;
        conn.execute_batch(schema::MIGRATION_1)?;

        let version = conn
            .query_row(
                "SELECT value FROM meta WHERE key = ?1",
                [META_SCHEMA_VERSION],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .map(|value| {
                value
                    .parse::<i64>()
                    .map_err(|_| AppError::internal("invalid database schema version"))
            })
            .transpose()?
            .unwrap_or_default();

        if version > schema::SCHEMA_VERSION {
            return Err(AppError::internal(format!(
                "database schema version {version} is newer than supported version {}",
                schema::SCHEMA_VERSION
            )));
        }
        if version < 2 {
            conn.execute_batch(schema::MIGRATION_2)?;
        }
        if version < 3 {
            conn.execute_batch(schema::MIGRATION_3)?;
        }
        if version < 4 {
            conn.execute_batch(schema::MIGRATION_4)?;
        }

        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (META_SCHEMA_VERSION, schema::SCHEMA_VERSION.to_string()),
        )?;
        Ok(())
    }
}

pub fn get_meta(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    let value = conn
        .query_row("SELECT value FROM meta WHERE key = ?1", [key], |row| {
            row.get::<_, String>(0)
        })
        .optional()?;
    Ok(value)
}

pub fn set_meta(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )?;
    Ok(())
}

pub fn get_meta_bool(conn: &Connection, key: &str, fallback: bool) -> AppResult<bool> {
    Ok(get_meta(conn, key)?
        .map(|value| value == "true")
        .unwrap_or(fallback))
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrating_creates_every_table() {
        let db = Db::open_in_memory().unwrap();

        let tables: Vec<String> = db
            .with_conn(|conn| {
                let mut stmt =
                    conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")?;
                let rows = stmt
                    .query_map([], |row| row.get::<_, String>(0))?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(rows)
            })
            .unwrap();

        for expected in [
            "roots",
            "files",
            "scans",
            "sync_groups",
            "sync_members",
            "backups",
            "meta",
            "prompt_history",
            "favorite_projects",
            "prompt_attachments",
        ] {
            assert!(tables.iter().any(|t| t == expected), "missing {expected}");
        }
    }

    #[test]
    fn migrating_is_idempotent() {
        let db = Db::open_in_memory().unwrap();
        db.migrate().unwrap();

        let version = db
            .with_conn(|conn| get_meta(conn, META_SCHEMA_VERSION))
            .unwrap();

        assert_eq!(version.as_deref(), Some("4"));
    }

    #[test]
    fn migrating_from_version_one_adds_prompt_history() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(schema::MIGRATION_1).unwrap();
        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, '1')",
            [META_SCHEMA_VERSION],
        )
        .unwrap();

        let db = Db::from_connection(conn).unwrap();
        let prompt_tables: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'prompt_history'",
                    [],
                    |row| row.get(0),
                )?)
            })
            .unwrap();

        assert_eq!(prompt_tables, 1);
        assert_eq!(
            db.with_conn(|conn| get_meta(conn, META_SCHEMA_VERSION))
                .unwrap()
                .as_deref(),
            Some("4")
        );
    }

    #[test]
    fn migrating_from_version_two_adds_favorite_projects() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(schema::MIGRATION_1).unwrap();
        conn.execute_batch(schema::MIGRATION_2).unwrap();
        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, '2')",
            [META_SCHEMA_VERSION],
        )
        .unwrap();

        let db = Db::from_connection(conn).unwrap();
        let favorite_tables: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'favorite_projects'",
                    [],
                    |row| row.get(0),
                )?)
            })
            .unwrap();

        assert_eq!(favorite_tables, 1);
        assert_eq!(
            db.with_conn(|conn| get_meta(conn, META_SCHEMA_VERSION))
                .unwrap()
                .as_deref(),
            Some("4")
        );
    }

    #[test]
    fn migrating_from_version_three_adds_prompt_attachments() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(schema::MIGRATION_1).unwrap();
        conn.execute_batch(schema::MIGRATION_2).unwrap();
        conn.execute_batch(schema::MIGRATION_3).unwrap();
        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, '3')",
            [META_SCHEMA_VERSION],
        )
        .unwrap();

        let db = Db::from_connection(conn).unwrap();
        let attachment_tables: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row(
                    "SELECT COUNT(*) FROM sqlite_master
                     WHERE type = 'table' AND name = 'prompt_attachments'",
                    [],
                    |row| row.get(0),
                )?)
            })
            .unwrap();

        assert_eq!(attachment_tables, 1);
        assert_eq!(
            db.with_conn(|conn| get_meta(conn, META_SCHEMA_VERSION))
                .unwrap()
                .as_deref(),
            Some("4")
        );
    }

    #[test]
    fn a_failing_transaction_rolls_back() {
        let db = Db::open_in_memory().unwrap();

        let result: AppResult<()> = db.with_tx(|tx| {
            tx.execute(
                "INSERT INTO roots (path, enabled, added_at) VALUES ('/tmp/x', 1, 0)",
                [],
            )?;
            Err(AppError::internal("boom"))
        });

        assert!(result.is_err());
        let count: i64 = db
            .with_conn(|conn| {
                Ok(conn.query_row("SELECT COUNT(*) FROM roots", [], |row| row.get(0))?)
            })
            .unwrap();
        assert_eq!(count, 0);
    }
}
