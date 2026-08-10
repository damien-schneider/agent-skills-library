import { countChanges, diffLines } from "@/lib/diff";
import { cn } from "@/lib/utils";

export interface DiffViewProps {
  before: string;
  after: string;
  className?: string;
}

const OP_STYLES = {
  equal: "text-muted-foreground",
  added: "bg-chart-1/15 text-foreground",
  removed: "bg-destructive/15 text-foreground",
} as const;

const OP_MARKERS = { equal: " ", added: "+", removed: "-" } as const;

export function DiffView({ before, after, className }: DiffViewProps) {
  const lines = diffLines(before, after);
  const { added, removed } = countChanges(lines);

  if (added + removed === 0) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        No changes.
      </p>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <p className="text-muted-foreground text-xs">
        <span className="text-chart-1">+{added}</span>{" "}
        <span className="text-destructive">-{removed}</span> lines
      </p>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {lines.map((line, position) => (
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
