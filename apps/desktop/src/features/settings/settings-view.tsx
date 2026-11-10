import { Separator } from "@ctrl-ui/react/ui/separator";

import type { UseScan } from "@/features/scan/use-scan";
import type { UseAppUpdate } from "@/features/updates/use-app-update";
import { ViewLayout } from "@/shared/components/view-layout";

import { AboutSection } from "./about-section";
import { FoldersSection } from "./folders-section";
import { IndexingSection } from "./indexing-section";
import { useWatcher } from "./use-watcher";

export function SettingsView({
  scan,
  update,
  onFoldersChanged,
}: {
  scan: UseScan;
  update: UseAppUpdate;
  onFoldersChanged: () => void;
}) {
  const watcher = useWatcher();
  const { refresh: refreshWatcher } = watcher;

  return (
    <ViewLayout title="Settings" width="prose">
      <FoldersSection
        onFoldersChanged={() => {
          onFoldersChanged();
          // The watcher only runs while a folder is indexed, so its state follows the folders.
          refreshWatcher();
        }}
        scan={scan}
      />
      <Separator />
      <IndexingSection scan={scan} watcher={watcher} />
      <Separator />
      <AboutSection update={update} />
    </ViewLayout>
  );
}
