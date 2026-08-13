import { ConvexProvider } from "convex/react";
import { Store } from "lucide-react";

import { convexClient } from "@/lib/convex";
import { EmptyState, ViewLayout } from "@/shared/components/view-layout";

import { RegistryView } from "./registry-view";

export function RegistryPane() {
  if (!convexClient) {
    return (
      <ViewLayout>
        <EmptyState
          description="Set VITE_CONVEX_URL to connect this build to agents-library.dev."
          icon={Store}
          title="Registry unavailable"
        />
      </ViewLayout>
    );
  }

  return (
    <ConvexProvider client={convexClient}>
      <RegistryView />
    </ConvexProvider>
  );
}
