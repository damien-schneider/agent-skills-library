pub const SCHEMA_VERSION: i64 = 6;

pub const MIGRATION_1: &str = r"
CREATE TABLE IF NOT EXISTS roots (
    id       INTEGER PRIMARY KEY,
    path     TEXT    NOT NULL UNIQUE,
    enabled  INTEGER NOT NULL DEFAULT 1,
    added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id                INTEGER PRIMARY KEY,
    root_id           INTEGER NOT NULL REFERENCES roots(id) ON DELETE CASCADE,
    path              TEXT    NOT NULL UNIQUE,
    rel_path          TEXT    NOT NULL,
    kind              TEXT    NOT NULL,
    project_dir       TEXT,
    size              INTEGER NOT NULL,
    mtime_ns          INTEGER NOT NULL,
    hash              TEXT    NOT NULL,
    is_symlink        INTEGER NOT NULL DEFAULT 0,
    symlink_target    TEXT,
    first_seen_at     INTEGER NOT NULL,
    last_seen_scan_id INTEGER,
    deleted_at        INTEGER
);

CREATE INDEX IF NOT EXISTS files_hash_idx ON files(hash);
CREATE INDEX IF NOT EXISTS files_kind_idx ON files(kind);
CREATE INDEX IF NOT EXISTS files_root_idx ON files(root_id);

CREATE TABLE IF NOT EXISTS scans (
    id          INTEGER PRIMARY KEY,
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    status      TEXT    NOT NULL,
    seen        INTEGER NOT NULL DEFAULT 0,
    hashed      INTEGER NOT NULL DEFAULT 0,
    added       INTEGER NOT NULL DEFAULT 0,
    changed     INTEGER NOT NULL DEFAULT 0,
    removed     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_groups (
    id                INTEGER PRIMARY KEY,
    name              TEXT    NOT NULL,
    canonical_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_members (
    group_id      INTEGER NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
    file_id       INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    strategy      TEXT    NOT NULL,
    baseline_hash TEXT,
    PRIMARY KEY (group_id, file_id)
);

CREATE TABLE IF NOT EXISTS backups (
    id            INTEGER PRIMARY KEY,
    file_id       INTEGER REFERENCES files(id) ON DELETE SET NULL,
    original_path TEXT    NOT NULL,
    backup_path   TEXT    NOT NULL,
    hash          TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
";

pub const MIGRATION_2: &str = r"
CREATE TABLE IF NOT EXISTS prompt_history (
    id               INTEGER PRIMARY KEY,
    content          TEXT    NOT NULL,
    destination_path TEXT,
    created_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS prompt_history_created_at_idx
ON prompt_history(created_at DESC);
";

pub const MIGRATION_3: &str = r"
CREATE TABLE IF NOT EXISTS favorite_projects (
    path       TEXT    PRIMARY KEY,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS favorite_projects_created_at_idx
ON favorite_projects(created_at DESC);
";

pub const MIGRATION_4: &str = r"
CREATE TABLE IF NOT EXISTS prompt_attachments (
    id           INTEGER PRIMARY KEY,
    prompt_id    INTEGER NOT NULL REFERENCES prompt_history(id) ON DELETE CASCADE,
    path         TEXT    NOT NULL UNIQUE,
    mime_type    TEXT    NOT NULL,
    width        INTEGER NOT NULL,
    height       INTEGER NOT NULL,
    created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS prompt_attachments_prompt_idx
ON prompt_attachments(prompt_id, id);
";

pub const MIGRATION_5: &str = r"
ALTER TABLE files ADD COLUMN name TEXT;

CREATE INDEX IF NOT EXISTS files_name_idx ON files(name);

CREATE TABLE IF NOT EXISTS file_refs (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name    TEXT    NOT NULL,
    PRIMARY KEY (file_id, name)
);

CREATE INDEX IF NOT EXISTS file_refs_name_idx ON file_refs(name);
";

pub const MIGRATION_6: &str = r"
ALTER TABLE files ADD COLUMN refs_hash TEXT;
";
