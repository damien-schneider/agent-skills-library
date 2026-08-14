import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { onCaptureSaved } from "@/lib/events";
import { deletePrompt, listPromptHistory, toIpcError } from "@/lib/ipc";
import type { PromptHistoryEntry } from "@/lib/ipc-types";
import { claudeCodePrompt } from "./prompt-attachments";
import { PromptComposer } from "./prompt-composer";
import { PromptHistoryList } from "./prompt-history-list";

type HistoryStatus =
  | { type: "loading" }
  | { type: "ready" }
  | { type: "error"; message: string };

interface DeleteState {
  pendingId: number | null;
  deleting: boolean;
}

const IDLE_DELETE_STATE: DeleteState = {
  pendingId: null,
  deleting: false,
};

export function PromptHistoryView() {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteState, setDeleteState] =
    useState<DeleteState>(IDLE_DELETE_STATE);
  const [status, setStatus] = useState<HistoryStatus>({ type: "loading" });
  const copiedTimerRef = useRef<number | undefined>(undefined);
  const deletingIdRef = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      window.clearTimeout(copiedTimerRef.current);
    },
    []
  );

  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) {
      return entries;
    }
    return entries.filter(
      (entry) =>
        entry.content.toLowerCase().includes(needle) ||
        entry.destinationPath?.toLowerCase().includes(needle)
    );
  }, [entries, search]);

  const handleCreated = useCallback((created: PromptHistoryEntry) => {
    setEntries((current) => [created, ...current]);
    setStatus({ type: "ready" });
  }, []);

  const handleCopy = async (entry: PromptHistoryEntry) => {
    try {
      await writeText(claudeCodePrompt(entry));
      setCopiedId(entry.id);
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error("Could not copy the prompt");
    }
  };

  const handleDeleteRequest = (pendingId: number | null) => {
    if (deletingIdRef.current !== null) {
      return;
    }
    setDeleteState({ pendingId, deleting: false });
  };

  const handleDelete = async (entry: PromptHistoryEntry) => {
    if (deletingIdRef.current !== null) {
      return;
    }
    deletingIdRef.current = entry.id;
    setDeleteState({ pendingId: entry.id, deleting: true });
    try {
      await deletePrompt(entry.id);
      setEntries((current) =>
        current.filter((candidate) => candidate.id !== entry.id)
      );
      setDeleteState(IDLE_DELETE_STATE);
      setCopiedId((current) => (current === entry.id ? null : current));
    } catch (cause) {
      toast.error(toIpcError(cause).message);
      setDeleteState({ pendingId: entry.id, deleting: false });
    } finally {
      deletingIdRef.current = null;
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(360px,44%)_1fr]">
      <PromptComposer onCreated={handleCreated} />
      <PromptHistoryList
        copiedId={copiedId}
        deletingId={deleteState.deleting ? deleteState.pendingId : null}
        entries={entries}
        error={status.type === "error" ? status.message : null}
        loading={status.type === "loading"}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onDeleteRequest={handleDeleteRequest}
        onRefresh={refresh}
        onSearch={setSearch}
        pendingDeleteId={deleteState.pendingId}
        search={search}
        visibleEntries={visibleEntries}
      />
    </div>
  );
}
