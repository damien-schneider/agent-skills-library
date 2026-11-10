import { Button } from "@ctrl-ui/react/ui/button";
import { Kbd } from "@ctrl-ui/react/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ctrl-ui/react/ui/tooltip";
import type { ComponentProps, ReactNode } from "react";

type IconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "iconOnly"
> & {
  /** Names the action for assistive tech and is what the tooltip shows. */
  label: string;
  /** Keyboard shortcut shown beside the label in the tooltip, e.g. `⌘N`. */
  shortcut?: string;
  children: ReactNode;
};

/** An icon-only action: the tooltip is the only place its name is visible. */
export function IconButton({
  label,
  shortcut,
  children,
  size = "sm",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            iconOnly
            size={size}
            variant={variant}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <Kbd className="ms-2">{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
