"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

const HOVER_DELAY_MS = 400;

export function Tooltip({
  children,
  label,
}: {
  children: ReactElement;
  label: string;
}) {
  return (
    <TooltipPrimitive.Provider delay={HOVER_DELAY_MS}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner sideOffset={6}>
            <TooltipPrimitive.Popup className="data-closed:fade-out-0 data-open:fade-in-0 rounded-lg bg-foreground px-2 py-1 text-background text-xs shadow-md data-closed:animate-out data-open:animate-in">
              {label}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
