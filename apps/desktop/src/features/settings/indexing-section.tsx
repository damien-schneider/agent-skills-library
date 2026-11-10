import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@ctrl-ui/react/ui/field";
import { Switch } from "@ctrl-ui/react/ui/switch";
import { useId } from "react";

import { ScanStatus } from "@/features/scan/scan-status";
import type { UseScan } from "@/features/scan/use-scan";

import { SettingsSection } from "./settings-section";
import type { UseWatcher } from "./use-watcher";

/** The setting reads at the size of the rows around it, not as a form field. Each part reads its own knob. */
const LABEL_STYLE = {
  "--cui-field-label-font-size": "var(--text-body)",
} as const;
const DESCRIPTION_STYLE = {
  "--cui-field-description-font-size": "var(--text-body)",
} as const;

/** How the index stays current: live as files change, and on demand with a rescan. */
export function IndexingSection({
  scan,
  watcher,
}: {
  scan: UseScan;
  watcher: UseWatcher;
}) {
  const switchId = useId();
  // Watching is on but has nothing to watch: every folder is excluded or removed.
  const idle = watcher.status?.enabled === true && !watcher.status.running;

  return (
    <SettingsSection title="Indexing">
      <Field invalid={watcher.error !== null} orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={switchId} style={LABEL_STYLE}>
            Watch for changes
          </FieldLabel>
          <FieldDescription style={DESCRIPTION_STYLE}>
            {idle
              ? "On, but no folder is being indexed yet."
              : "Files are re-indexed as soon as they change on disk."}
          </FieldDescription>
          {watcher.error === null ? null : (
            <FieldError match>{watcher.error}</FieldError>
          )}
        </FieldContent>
        <Switch
          checked={watcher.status?.enabled ?? false}
          disabled={watcher.status === null}
          id={switchId}
          onCheckedChange={(enabled) => {
            watcher.setEnabled(enabled);
          }}
        />
      </Field>
      <ScanStatus scan={scan} />
    </SettingsSection>
  );
}
