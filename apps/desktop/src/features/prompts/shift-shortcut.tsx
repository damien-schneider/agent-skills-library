import { cn } from "@ctrl-ui/react/lib/cn";
import { Kbd, KbdGroup } from "@ctrl-ui/react/ui/kbd";

export type ShiftShortcutProgress = 0 | 1 | 2;

const TAPS = [1, 2] as const;
const COMPLETED_KEY_STYLE = {
  "--cui-kbd-foreground": "var(--primary-foreground)",
} as const;

/** The two Shift taps of the capture shortcut; each key fills as its tap lands. */
export function ShiftShortcut({
  className,
  completedTaps,
}: {
  className?: string;
  completedTaps: ShiftShortcutProgress;
}) {
  return (
    <KbdGroup aria-hidden="true" className={className}>
      {TAPS.map((tap) => {
        const completed = completedTaps >= tap;
        return (
          <Kbd
            className="relative overflow-hidden"
            data-completed={completed}
            key={tap}
            style={completed ? COMPLETED_KEY_STYLE : undefined}
          >
            <span
              className={cn(
                "absolute inset-0 origin-bottom bg-primary transition-transform duration-150 ease-out motion-reduce:transition-none",
                completed ? "scale-y-100" : "scale-y-0"
              )}
            />
            <span className="relative">⇧</span>
          </Kbd>
        );
      })}
    </KbdGroup>
  );
}
