import { ConvexProvider } from "convex/react";
import { Store } from "lucide-react";

import type { LibraryIndex } from "@/features/library/use-library-index";
import { convexClient } from "@/lib/convex";
import { EmptyState, ViewLayout } from "@/shared/components/view-layout";

import { RegistryView } from "./registry-view";

export function RegistryPane({
  index,
  onInstalled,
}: {
  index: LibraryIndex;
  onInstalled: (fileId: number) => void;
}) {
  if (!convexClient) {
    return (
      <ViewLayout title="Registry">
        <EmptyState
          description="This build does not include it. Your Library works without it."
          icon={Store}
          title="The registry is not available"
        />
      </ViewLayout>
    );
  }

  return (
    <ConvexProvider client={convexClient}>
      <RegistryView index={index} onInstalled={onInstalled} />
    </ConvexProvider>
  );
}
