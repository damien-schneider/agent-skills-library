import { ConvexProvider } from "convex/react";

import { convexClient } from "@/lib/convex";

import { RegistryView } from "./registry-view";

export function RegistryPane() {
  if (!convexClient) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-muted-foreground text-sm">
        Set VITE_CONVEX_URL to browse the registry.
      </div>
    );
  }

  return (
    <ConvexProvider client={convexClient}>
      <RegistryView />
    </ConvexProvider>
  );
}
