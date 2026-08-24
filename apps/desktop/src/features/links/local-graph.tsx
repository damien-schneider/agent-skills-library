import type { FileKind } from "@skills-agent-library/skills-core/scan-targets";

import type { FileLinks, FileRow } from "@/lib/ipc-types";
import { cn } from "@/lib/utils";

import { linkLabel } from "./link-label";
import { SkillPreviewTrigger } from "./skill-preview";

const WIDTH = 288;
const HEIGHT = 168;
const RADIUS_X = 60;
const RADIUS_Y = 56;
const ARC_DEGREES = 60;
const PER_SIDE = 6;

const KIND_DOT: Record<FileKind, string> = {
  "claude-skill": "bg-chart-1",
  "claude-agent": "bg-chart-2",
  "cursor-rule": "bg-chart-3",
  "agents-md": "bg-chart-4",
  "claude-md": "bg-chart-5",
  "gemini-md": "bg-muted-foreground",
};

type Side = "left" | "right";

interface PlacedFile {
  file: FileRow;
  side: Side;
  x: number;
  y: number;
}

function place(files: FileRow[], side: Side): PlacedFile[] {
  const span = files.length > 1 ? (ARC_DEGREES * 2) / (files.length - 1) : 0;
  const direction = side === "right" ? 1 : -1;

  return files.map((file, index) => {
    const angle = ((index * span - ARC_DEGREES) * Math.PI) / 180;
    return {
      file,
      side,
      x: WIDTH / 2 + direction * RADIUS_X * Math.cos(angle),
      y: HEIGHT / 2 + RADIUS_Y * Math.sin(angle),
    };
  });
}

function Overflow({ count, side }: { count: number; side: Side }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 text-[10px] text-muted-foreground/70",
        side === "right" ? "right-0" : "left-0"
      )}
    >
      +{count}
    </span>
  );
}

function GraphNode({
  onOpen,
  placed,
}: {
  onOpen: (file: FileRow) => void;
  placed: PlacedFile;
}) {
  return (
    <SkillPreviewTrigger file={placed.file} onOpen={onOpen}>
      <button
        className={cn(
          "group absolute flex -translate-y-1/2 items-center gap-1.5",
          placed.side === "left" && "-translate-x-full flex-row-reverse"
        )}
        onClick={() => onOpen(placed.file)}
        style={{ left: placed.x, top: placed.y }}
        type="button"
      >
        <span
          className={cn(
            "size-2 shrink-0 rounded-full ring-background transition-[box-shadow] group-hover:ring-2 motion-reduce:transition-none",
            KIND_DOT[placed.file.kind]
          )}
        />
        <span className="max-w-16 truncate text-[10px] text-muted-foreground leading-none group-hover:text-foreground">
          {linkLabel(placed.file)}
        </span>
      </button>
    </SkillPreviewTrigger>
  );
}

/** The open file and what it links to, one hop out: incoming on the left, outgoing on the right. */
export function LocalGraph({
  links,
  onOpen,
}: {
  links: FileLinks;
  onOpen: (file: FileRow) => void;
}) {
  const incoming = links.incoming.slice(0, PER_SIDE);
  const outgoing = links.outgoing.slice(0, PER_SIDE);
  if (incoming.length === 0 && outgoing.length === 0) {
    return null;
  }

  const placed = [...place(incoming, "left"), ...place(outgoing, "right")];

  return (
    <div
      className="relative rounded-lg border border-border bg-background/85 shadow-sm backdrop-blur-sm"
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
        <title>Links of the open file</title>
        {placed.map((node) => (
          <line
            className="stroke-border"
            key={node.file.id}
            strokeWidth={1}
            x1={WIDTH / 2}
            x2={node.x}
            y1={HEIGHT / 2}
            y2={node.y}
          />
        ))}
        <circle
          className="fill-foreground"
          cx={WIDTH / 2}
          cy={HEIGHT / 2}
          r={4}
        />
      </svg>

      {placed.map((node) => (
        <GraphNode key={node.file.id} onOpen={onOpen} placed={node} />
      ))}

      {links.incoming.length > incoming.length ? (
        <Overflow count={links.incoming.length - incoming.length} side="left" />
      ) : null}
      {links.outgoing.length > outgoing.length ? (
        <Overflow
          count={links.outgoing.length - outgoing.length}
          side="right"
        />
      ) : null}
    </div>
  );
}
