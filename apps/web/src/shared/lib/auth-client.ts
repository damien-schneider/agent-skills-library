import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});

// Re-export for backwards compatibility and clearer naming
export const useAuthClient = authClient;
