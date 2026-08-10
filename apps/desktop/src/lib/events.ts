import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  IndexUpdatedEvent,
  ScanDoneEvent,
  ScanErrorEvent,
  ScanProgressEvent,
} from "./ipc-types";

export const SCAN_PROGRESS = "scan:progress";
export const SCAN_DONE = "scan:done";
export const SCAN_ERROR = "scan:error";
export const INDEX_UPDATED = "index:updated";

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
