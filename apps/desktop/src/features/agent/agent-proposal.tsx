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
