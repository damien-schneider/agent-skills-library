import type { EditorView } from "@tiptap/pm/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FileRow } from "@/lib/ipc-types";

import { MENTION_ATTRIBUTE } from "./skill-mention";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 150;

export interface MentionPopupProps {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export interface HoveredMention {
  file: FileRow;
  anchor: Element;
}

/**
 * Mentions are ProseMirror decorations, not React nodes, so the editor plugin owns
 * their pointer events and this hook only keeps the resulting card state.
 */
export function useMentionHover({
  targets,
  onOpen,
}: {
  targets: Map<string, FileRow>;
  onOpen: (file: FileRow) => void;
}) {
  const [hovered, setHovered] = useState<HoveredMention | null>(null);
  const latest = useRef({ targets, onOpen, hovered });
  latest.current = { targets, onOpen, hovered };

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const schedule = useCallback(
    (next: HoveredMention | null, delay: number) => {
      cancel();
      timer.current = setTimeout(() => setHovered(next), delay);
    },
    [cancel]
  );

  const close = useCallback(() => {
    cancel();
    setHovered(null);
  }, [cancel]);

  const mentionAt = useCallback(
    (target: EventTarget | null): HoveredMention | null => {
      const anchor =
        target instanceof Element
          ? target.closest(`[${MENTION_ATTRIBUTE}]`)
          : null;
      const name = anchor?.getAttribute(MENTION_ATTRIBUTE);
      const file = name ? latest.current.targets.get(name) : undefined;
      return anchor && file ? { file, anchor } : null;
    },
    []
  );

  const domEvents = useMemo(
    () => ({
      pointerover: (_view: EditorView, event: Event) => {
        const mention = mentionAt(event.target);
        if (mention && mention.anchor !== latest.current.hovered?.anchor) {
          schedule(mention, OPEN_DELAY);
        }
        return false;
      },
      pointerout: (_view: EditorView, event: Event) => {
        if (mentionAt(event.target)) {
          schedule(null, CLOSE_DELAY);
        }
        return false;
      },
      click: (view: EditorView, event: Event) => {
        const modified =
          event instanceof MouseEvent && (event.metaKey || event.ctrlKey);
        const mention =
          view.editable && !modified ? null : mentionAt(event.target);
        if (!mention) {
          return false;
        }
        close();
        latest.current.onOpen(mention.file);
        return true;
      },
    }),
    [close, mentionAt, schedule]
  );

  return {
    hovered,
    close,
    domEvents,
    popupProps: {
      onPointerEnter: cancel,
      onPointerLeave: () => schedule(null, CLOSE_DELAY),
    },
  };
}
