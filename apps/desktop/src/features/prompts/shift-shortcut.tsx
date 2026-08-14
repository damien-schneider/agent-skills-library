import { cn } from "@/lib/utils";

export type ShiftShortcutProgress = 0 | 1 | 2;

export function ShiftShortcut({
  className,
  completedTaps,
  contrast = "app",
}: {
  className?: string;
  completedTaps: ShiftShortcutProgress;
  contrast?: "app" | "overlay";
}) {
  const taps: readonly [1, 2] = [1, 2];

  return (
    <span
      aria-hidden="true"
      className={cn("flex items-center gap-1", className)}
    >
      {taps.map((tap) => {
        const completed = completedTaps >= tap;
        return (
          <kbd
            className={cn(
              "relative flex size-[22px] overflow-hidden rounded-md font-sans text-[10px]",
              contrast === "overlay"
                ? "bg-white/10 text-white"
                : "bg-background text-foreground shadow-sm"
            )}
            data-completed={completed}
            key={tap}
          >
            <span
              className={cn(
                "absolute inset-0 origin-bottom transition-transform duration-150 ease-out motion-reduce:transition-none",
                completed ? "scale-y-100" : "scale-y-0",
                contrast === "overlay" ? "bg-white" : "bg-primary"
              )}
            />
            <span
              className={cn(
                "relative m-auto transition-colors duration-150 motion-reduce:transition-none",
                completed &&
                  (contrast === "overlay"
                    ? "text-neutral-950"
                    : "text-primary-foreground")
              )}
            >
              ⇧
            </span>
          </kbd>
        );
      })}
    </span>
  );
}
