import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/react";

export const MENTION_ATTRIBUTE = "data-skill";
const MENTION_CLASS = "skill-mention";
const WORD_CHARACTER = /[a-z0-9-]/i;

export type MentionDomEvents = Record<
  string,
  (view: EditorView, event: Event) => boolean
>;

/**
 * Which names are linked is decided by the backend index; this store only carries
 * the current answer to the running editor. Every member is a closure on purpose:
 * `Extension.configure` deep-clones plain option objects, which would freeze a data
 * property at whatever it held when the editor was built.
 */
export interface MentionStore {
  names: () => readonly string[];
  set: (names: readonly string[]) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createMentionStore(): MentionStore {
  const listeners = new Set<() => void>();
  let names: readonly string[] = [];

  return {
    names: () => names,
    set(next) {
      if (
        next.length === names.length &&
        next.every((name, index) => name === names[index])
      ) {
        return;
      }
      names = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function isBoundary(character: string | undefined): boolean {
  return character === undefined || !WORD_CHARACTER.test(character);
}

export interface MentionRange {
  name: string;
  from: number;
}

/** Whole-word occurrences of already-resolved names; the index decided which names link. */
export function mentionRanges(
  text: string,
  names: readonly string[]
): MentionRange[] {
  const haystack = text.toLowerCase();
  const ranges: MentionRange[] = [];

  for (const name of names) {
    let from = haystack.indexOf(name);
    while (from !== -1) {
      if (isBoundary(text[from - 1]) && isBoundary(text[from + name.length])) {
        ranges.push({ name, from });
      }
      from = haystack.indexOf(name, from + name.length);
    }
  }

  return ranges;
}

const pluginKey = new PluginKey("skillMention");

export const SkillMention = Extension.create<{
  store: MentionStore;
  domEvents: MentionDomEvents;
}>({
  name: "skillMention",

  addOptions() {
    return { store: createMentionStore(), domEvents: {} };
  },

  addProseMirrorPlugins() {
    const { store, domEvents } = this.options;

    return [
      new Plugin({
        key: pluginKey,
        view(editorView) {
          const unsubscribe = store.subscribe(() => {
            editorView.dispatch(editorView.state.tr);
          });
          return { destroy: unsubscribe };
        },
        props: {
          handleDOMEvents: domEvents,
          decorations(state) {
            const names = store.names();
            if (names.length === 0) {
              return null;
            }
            const decorations: Decoration[] = [];
            state.doc.descendants((node, position) => {
              if (!(node.isText && node.text)) {
                return;
              }
              for (const { name, from } of mentionRanges(node.text, names)) {
                decorations.push(
                  Decoration.inline(
                    position + from,
                    position + from + name.length,
                    {
                      class: MENTION_CLASS,
                      [MENTION_ATTRIBUTE]: name,
                    }
                  )
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
