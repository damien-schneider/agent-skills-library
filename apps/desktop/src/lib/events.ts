import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  CaptureAccessStatus,
  CaptureErrorEvent,
  CaptureShortcutProgress,
  IndexUpdatedEvent,
  PromptHistoryEntry,
  ScanDoneEvent,
  ScanErrorEvent,
  ScanProgressEvent,
} from "./ipc-types";

export const SCAN_PROGRESS = "scan:progress";
export const SCAN_DONE = "scan:done";
export const SCAN_ERROR = "scan:error";
export const INDEX_UPDATED = "index:updated";
export const CAPTURE_SAVED = "capture:saved";
export const CAPTURE_ERROR = "capture:error";
export const CAPTURE_ACCESS_CHANGED = "capture:access-changed";
export const CAPTURE_SHORTCUT_PROGRESS = "capture:shortcut-progress";

function on<T>(
  event: string,
  handler: (payload: T) => void
): Promise<UnlistenFn> {
  return listen<T>(event, ({ payload }) => handler(payload));
}

export const onScanProgress = (handler: (payload: ScanProgressEvent) => void) =>
  on<ScanProgressEvent>(SCAN_PROGRESS, handler);

export const onScanDone = (handler: (payload: ScanDoneEvent) => void) =>
  on<ScanDoneEvent>(SCAN_DONE, handler);

export const onScanError = (handler: (payload: ScanErrorEvent) => void) =>
  on<ScanErrorEvent>(SCAN_ERROR, handler);

export const onIndexUpdated = (handler: (payload: IndexUpdatedEvent) => void) =>
  on<IndexUpdatedEvent>(INDEX_UPDATED, handler);

export const onCaptureSaved = (
  handler: (payload: PromptHistoryEntry) => void
) => on<PromptHistoryEntry>(CAPTURE_SAVED, handler);

export const onCaptureError = (handler: (payload: CaptureErrorEvent) => void) =>
  on<CaptureErrorEvent>(CAPTURE_ERROR, handler);

export const onCaptureShortcutProgress = (
  handler: (payload: CaptureShortcutProgress) => void
) => on<CaptureShortcutProgress>(CAPTURE_SHORTCUT_PROGRESS, handler);

export const onCaptureAccessChanged = (
  handler: (payload: CaptureAccessStatus) => void
) => on<CaptureAccessStatus>(CAPTURE_ACCESS_CHANGED, handler);
