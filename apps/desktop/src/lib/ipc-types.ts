export type { FileKind } from "@skills-agent-library/skills-core/scan-targets";

import type { FileKind } from "@skills-agent-library/skills-core/scan-targets";

/** Mirrors src-tauri/src/error.rs */
export type AppErrorCode =
  | "not_found"
  | "invalid_path"
  | "outside_roots"
  | "conflict"
  | "scan_busy"
  | "io"
  | "db"
  | "internal";

export interface AppErrorPayload {
  code: AppErrorCode;
  message: string;
}

/** Mirrors db::roots_repo::Root */
export interface Root {
  id: number;
  path: string;
  enabled: boolean;
  addedAt: number;
}

/** Mirrors db::files_repo::FileRow */
export interface FileRow {
  id: number;
  rootId: number;
  path: string;
  relPath: string;
  kind: FileKind;
  projectDir: string | null;
  size: number;
  mtimeNs: number;
  hash: string;
  isSymlink: boolean;
  symlinkTarget: string | null;
  firstSeenAt: number;
  lastSeenScanId: number | null;
  deletedAt: number | null;
}

/** Mirrors db::files_repo::DuplicateGroup */
export interface DuplicateGroup {
  hash: string;
  files: FileRow[];
}

/** Mirrors commands::files::FileContent */
export interface FileContent {
  fileId: number;
  path: string;
  content: string;
  hash: string;
  mtimeMs: number;
  isSymlink: boolean;
  symlinkTarget: string | null;
}

/** Mirrors commands::files::WriteResult */
export interface WriteResult {
  fileId: number;
  hash: string;
  mtimeMs: number;
  size: number;
}

/** Mirrors commands::files::ListFilesArgs */
export interface ListFilesArgs {
  kinds?: FileKind[];
  rootId?: number;
  search?: string;
  includeDeleted?: boolean;
}

/** Mirrors commands::watcher::WatcherStatus */
export interface WatcherStatus {
  enabled: boolean;
  running: boolean;
}

/** Mirrors scanner::ScanStats */
export interface ScanStats {
  seen: number;
  hashed: number;
  added: number;
  changed: number;
  removed: number;
}

export interface ScanProgressEvent extends ScanStats {
  scanId: number;
}

export interface ScanDoneEvent extends ScanStats {
  scanId: number;
  cancelled: boolean;
}

export interface ScanErrorEvent {
  scanId: number;
  code: AppErrorCode;
  message: string;
}

export interface IndexUpdatedEvent {
  fileIds: number[];
}

/** Mirrors db::groups_repo::Strategy */
export type SyncStrategy = "copy" | "symlink";

/** Mirrors sync::apply::MemberStatus */
export type MemberStatus = "in-sync" | "drifted" | "missing" | "symlinked";

/** Mirrors sync::apply::SyncAction */
export type SyncAction = "skip" | "copy" | "symlink" | "create";

/** Mirrors sync::guards::SyncWarning */
export type SyncWarning =
  | "git-tracked"
  | "windows-symlink"
  | "cloud-folder"
  | "existing-symlink";

/** Mirrors sync::diff::DiffResult */
export interface DiffLine {
  op: "equal" | "added" | "removed";
  text: string;
  leftNumber: number | null;
  rightNumber: number | null;
}

export interface DiffResult {
  identical: boolean;
  added: number;
  removed: number;
  lines: DiffLine[];
}

/** Mirrors commands::sync::SyncGroupView */
export interface SyncGroupView {
  id: number;
  name: string;
  canonicalFileId: number | null;
  createdAt: number;
  canonical: FileRow | null;
  members: SyncMemberView[];
}

export interface SyncMemberView {
  file: FileRow;
  strategy: SyncStrategy;
  baselineHash: string | null;
  status: MemberStatus;
}

/** Mirrors sync::apply::MemberPlan */
export interface MemberPlan {
  fileId: number;
  path: string;
  relPath: string;
  strategy: SyncStrategy;
  status: MemberStatus;
  action: SyncAction;
  warnings: SyncWarning[];
  diff: DiffResult | null;
}

/** Mirrors sync::apply::SyncPreview */
export interface SyncPreview {
  groupId: number;
  groupName: string;
  canonicalFileId: number;
  canonicalPath: string;
  token: string;
  members: MemberPlan[];
}

/** Mirrors sync::apply::ApplyResult */
export interface ApplyResult {
  updatedFileIds: number[];
  backupIds: number[];
  skipped: number;
}

/** Mirrors db::backups_repo::Backup */
export interface Backup {
  id: number;
  fileId: number | null;
  originalPath: string;
  backupPath: string;
  hash: string;
  createdAt: number;
}

/** Mirrors commands::registry::InstallResult */
export interface InstallResult {
  written: string[];
  skipped: string[];
  fileIds: number[];
}
