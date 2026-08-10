import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function createDesktopEnv(
  runtimeEnv: Record<string, string | undefined>
) {
  return createEnv({
    clientPrefix: "VITE_",
    client: {
      // required once the registry view ships
      VITE_CONVEX_URL: z.url().optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export type DesktopEnv = ReturnType<typeof createDesktopEnv>;
