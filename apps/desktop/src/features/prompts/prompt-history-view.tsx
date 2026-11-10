import { useCallback, useEffect, useState } from "react";

import { onCaptureSaved } from "@/lib/events";
import { listPromptHistory, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { ViewLayout } from "@/shared/components/view-layout";
import { CaptureShortcut } from "./capture-shortcut";
import { DeletePromptDialog } from "./delete-prompt-dialog";
import { PromptComposer } from "./prompt-composer";
import {
  PromptHistoryList,
  type PromptHistoryStatus,
} from "./prompt-history-list";

export function PromptHistoryView() {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [status, setStatus] = useState<PromptHistoryStatus>({
    type: "loading",
  });
  const [pendingDelete, setPendingDelete] = useState<PromptHistoryEntry | null>(
    null
  );

  const refresh = useCallback(async () => {
    setStatus({ type: "loading" });
    try {
      setEntries(await listPromptHistory());
      setStatus({ type: "ready" });
    } catch (cause) {
      setStatus({ type: "error", message: toIpcError(cause).message });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = onCaptureSaved((captured) => {
      setEntries((current) => [
        captured,
        ...current.filter((entry) => entry.id !== captured.id),
      ]);
    }).catch(() => undefined);
    return () => {
      unlisten.then((stop) => stop?.()).catch(() => undefined);
    };
  }, []);

  const handleCreated = useCallback((created: PromptHistoryEntry) => {
    setEntries((current) => [created, ...current]);
    setStatus({ type: "ready" });
  }, []);

  const handleDeleted = useCallback((deleted: PromptHistoryEntry) => {
    setEntries((current) =>
      current.filter((candidate) => candidate.id !== deleted.id)
    );
    setPendingDelete(null);
  }, []);

  return (
    <ViewLayout title="Prompts">
      <div className="flex flex-col gap-3">
        {/* The composer reserves a gutter around its field for a chat dock;
            pulled back so the field sits on the page column. */}
        <div className="-mx-2.5 -mt-1 -mb-2.5">
          <PromptComposer onCreated={handleCreated} />
        </div>
        <CaptureShortcut />
      </div>
      <PromptHistoryList
        entries={entries}
        onRequestDelete={setPendingDelete}
        onRetry={refresh}
        status={status}
      />
      <DeletePromptDialog
        entry={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onDeleted={handleDeleted}
      />
    </ViewLayout>
  );
}
