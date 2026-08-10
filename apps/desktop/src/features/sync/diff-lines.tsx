import type { DiffResult } from "@/lib/ipc-types";
import { cn } from "@/lib/utils";

const OP_STYLES = {
  equal: "text-muted-foreground",
  added: "bg-chart-1/15 text-foreground",
  removed: "bg-destructive/15 text-foreground",
} as const;

const OP_MARKERS = { equal: " ", added: "+", removed: "-" } as const;

/** Renders a diff computed by Rust; the TS-side DiffView renders unsaved buffers. */
export function DiffLines({
  diff,
  className,
}: {
  diff: DiffResult;
  className?: string;
}) {
  if (diff.identical) {
    return (
      <p className={cn("text-muted-foreground text-xs", className)}>
        No changes.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-muted-foreground text-xs">
        <span className="text-chart-1">+{diff.added}</span>{" "}
        <span className="text-destructive">-{diff.removed}</span> lines
      </p>
      <div className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/20">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {diff.lines.map((line, position) => (
              <tr
                className={OP_STYLES[line.op]}
                key={`${line.op}-${line.leftNumber}-${line.rightNumber}-${position}`}
              >
                <td className="w-10 select-none px-2 text-right text-muted-foreground/60">
                  {line.leftNumber ?? ""}
                </td>
                <td className="w-10 select-none px-2 text-right text-muted-foreground/60">
                  {line.rightNumber ?? ""}
                </td>
                <td className="w-4 select-none text-center">
                  {OP_MARKERS[line.op]}
                </td>
                <td className="whitespace-pre-wrap px-2 py-px">{line.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
