import {
  Activity,
  ActivityIcon,
  ActivityRow,
  ActivityTitle,
} from "@ctrl-ui/react/activity";
import { Button } from "@ctrl-ui/react/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ctrl-ui/react/ui/card";

import { DiffView } from "@/shared/components/diff-view";

export interface AgentProposalProps {
  before: string;
  after: string;
  onApply: () => void;
  onDismiss: () => void;
}

export function AgentProposal({
  before,
  after,
  onApply,
  onDismiss,
}: AgentProposalProps) {
  return (
    <Card size="sm">
      <CardHeader>
        {/* biome-ignore lint/a11y/useHeadingContent: the title's children become the heading's content */}
        <CardTitle render={<h3 />}>Proposed changes</CardTitle>
        <CardDescription>
          Applying updates the editor. The file on disk changes only when you
          save.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DiffView after={after} before={before} className="max-h-64" />
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button onClick={onDismiss} size="sm" variant="ghost">
          Dismiss
        </Button>
        <Button onClick={onApply} size="sm" tone="primary" variant="solid">
          Apply to editor
        </Button>
      </CardFooter>
    </Card>
  );
}

/** A proposal that went into the editor, kept so it can be taken back out. */
export interface AppliedChange {
  before: string;
  after: string;
  undone: boolean;
}

export interface AppliedNoticeProps {
  change: AppliedChange;
  documentText: string;
  onUndo: () => void;
  onReapply: () => void;
}

/**
 * Undo only shows while the editor still holds exactly what was applied: once the
 * user types, swapping the document back would throw their own edits away.
 */
export function AppliedNotice({
  change,
  documentText,
  onUndo,
  onReapply,
}: AppliedNoticeProps) {
  const expected = change.undone ? change.before : change.after;
  const untouched = documentText === expected;

  return (
    <div className="flex items-center justify-between gap-2">
      <Activity state="success">
        <ActivityRow>
          <ActivityIcon />
          <ActivityTitle>
            {change.undone ? "Change undone" : "Applied to the editor"}
          </ActivityTitle>
        </ActivityRow>
      </Activity>
      {untouched ? (
        <Button
          onClick={change.undone ? onReapply : onUndo}
          size="sm"
          variant="ghost"
        >
          {change.undone ? "Apply again" : "Undo"}
        </Button>
      ) : null}
    </div>
  );
}
