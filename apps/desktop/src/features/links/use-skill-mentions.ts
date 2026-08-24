import type { Extensions } from "@tiptap/react";
import { useEffect, useMemo } from "react";

import type { FileRow } from "@/lib/ipc-types";

import { createMentionStore, SkillMention } from "./skill-mention";
import type { HoveredMention, MentionPopupProps } from "./use-mention-hover";
import { useMentionHover } from "./use-mention-hover";

export interface SkillMentions {
  extensions: Extensions;
  hovered: HoveredMention | null;
  close: () => void;
  openFile: (file: FileRow) => void;
  popupProps: MentionPopupProps;
}

/** Turns the files a document references into hoverable mentions inside its text. */
export function useSkillMentions({
  targets,
  onOpen,
}: {
  targets: FileRow[];
  onOpen: (file: FileRow) => void;
}): SkillMentions {
  const store = useMemo(createMentionStore, []);

  const byName = useMemo(() => {
    const named = new Map<string, FileRow>();
    for (const target of targets) {
      if (target.name) {
        named.set(target.name, target);
      }
    }
    return named;
  }, [targets]);

  const hover = useMentionHover({ targets: byName, onOpen });

  const extensions = useMemo(
    () => [SkillMention.configure({ store, domEvents: hover.domEvents })],
    [store, hover.domEvents]
  );

  useEffect(() => {
    store.set([...byName.keys()]);
  }, [store, byName]);

  return {
    extensions,
    hovered: hover.hovered,
    close: hover.close,
    openFile: onOpen,
    popupProps: hover.popupProps,
  };
}
