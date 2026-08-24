import { Diff } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Tooltip } from "@/shared/components/ui/tooltip";

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  onReview: () => void;
  onSave: () => Promise<void>;
}

export function SaveBar({ dirty, saving, onReview, onSave }: SaveBarProps) {
  return (
    <>
      <span aria-live="polite" className="sr-only">
        {dirty ? "Unsaved changes" : "No unsaved changes"}
      </span>
      {dirty ? (
        <div className="absolute right-6 bottom-6 flex items-center gap-1 rounded-full bg-background/90 p-1 shadow-lg ring-1 ring-border/60 backdrop-blur">
          <Tooltip label="Review changes">
            <Button
              aria-label="Review changes"
              onClick={onReview}
              size="icon-sm"
              variant="ghost"
            >
              <Diff />
            </Button>
          </Tooltip>
          <Button
            disabled={saving}
            onClick={async () => {
              await onSave();
            }}
            size="sm"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
